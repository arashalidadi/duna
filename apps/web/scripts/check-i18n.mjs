import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createTranslator } from 'next-intl';
const root = path.resolve(import.meta.dirname, '..');
const locales = ['en', 'fa', 'ar'];
const messages = Object.fromEntries(locales.map(l => [l, JSON.parse(fs.readFileSync(path.join(root, `messages/${l}.json`), 'utf8'))]));
function flatten(value, prefix = '', output = {}) {
  for (const [key, item] of Object.entries(value)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof item === 'object' && item !== null) flatten(item, name, output);
    else output[name] = item;
  }
  return output;
}
const flattened = Object.fromEntries(locales.map(l => [l, flatten(messages[l])]));
const errors = new Set();
for (const locale of locales) {
  const t = createTranslator({ locale, messages: messages[locale], onError: error => errors.add(`${locale}: ${error.message}`) });
  for (const [key, text] of Object.entries(flattened.en)) {
    const translated = flattened[locale][key];
    if (typeof translated !== 'string') { errors.add(`${locale}: missing ${key}`); continue; }
    // Check ICU variables and parse/format every string, including dialogs not opened in route smoke tests.
    const variables = s => Array.from(s.matchAll(/\{\s*([A-Za-z]\w*)\s*[,}]/g), m => m[1]).sort();
    const expected = variables(text), actual = variables(translated);
    if (JSON.stringify([...new Set(expected)]) !== JSON.stringify([...new Set(actual)])) errors.add(`${locale}: ICU variable mismatch at ${key}`);
    const values = Object.fromEntries(expected.map(name => [name, 2]));
    t(key, values);
  }
}
function inspect(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const file = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node, bindings) {
    if (ts.isBlock(node) || ts.isSourceFile(node)) {
      bindings = { ...bindings };
      for (const statement of node.statements ?? []) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
          const init = declaration.initializer;
          if (init && ts.isCallExpression(init) && /^(useTranslations|useUiTranslations)$/.test(init.expression.getText(file)) && init.arguments[0] && ts.isStringLiteral(init.arguments[0])) bindings[declaration.name.getText(file)] = init.arguments[0].text;
        }
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && bindings[node.expression.text] && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      const key = `${bindings[node.expression.text]}.${node.arguments[0].text}`;
      for (const locale of locales) if (typeof flattened[locale][key] !== 'string') errors.add(`${locale}: unresolved ${key} in ${path.relative(root, filePath)}`);
    }
    ts.forEachChild(node, child => visit(child, bindings));
  }
  visit(file, {});
}
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (full.endsWith('.tsx')) inspect(full);
  }
}
walk(path.join(root, 'src'));
if (errors.size) { console.error([...errors].join('\n')); process.exit(1); }
console.log(`I18N GUARD OK — ${Object.keys(flattened.en).length} messages, 3 locales, ICU variables/formats and static translation calls verified.`);
