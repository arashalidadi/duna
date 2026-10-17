#!/usr/bin/env node
/** P11: fail the build when a newly added HTTP route has no explicit policy. */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const sourceDir = path.resolve('apps/api/src');
const permissionFiles = [
  'prisma/seed/core.ts', 'prisma/seed/phase9-permissions.ts',
  'prisma/seed/phase10-permissions.ts', 'prisma/seed/phase11-permissions.ts',
  'prisma/seed/phase12-permissions.ts',
];
const errors = [];
const matrix = [];
const catalogue = new Set();
let routes = 0;
let publicRoutes = 0;
let selfRoutes = 0;
let protectedRoutes = 0;
const source = (filename) => ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
const decorators = (node) => ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
const name = (decorator, file) => {
  const expr = decorator.expression;
  return ts.isCallExpression(expr) ? expr.expression.getText(file) : expr.getText(file);
};
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (entry.name.endsWith('.controller.ts')) checkController(file);
  }
}
for (const filename of permissionFiles) {
  const file = source(filename);
  const walk = (node) => {
    if (ts.isPropertyAssignment(node) && node.name.getText(file) === 'code' && ts.isStringLiteral(node.initializer)) {
      catalogue.add(node.initializer.text);
    }
    ts.forEachChild(node, walk);
  };
  walk(file);
}
function checkController(filename) {
  const file = source(filename);
  const walk = (node) => {
    if (ts.isClassDeclaration(node)) {
      const classDecorators = decorators(node);
      const controller = classDecorators.find((d) => name(d, file) === 'Controller');
      const controllerArg = controller && ts.isCallExpression(controller.expression)
        ? controller.expression.arguments[0] : null;
      const prefix = controllerArg && ts.isStringLiteral(controllerArg) ? controllerArg.text : '';
      for (const method of node.members) {
        if (!ts.isMethodDeclaration(method)) continue;
        const methodDecorators = decorators(method);
        const route = methodDecorators.find((d) => ['Get', 'Post', 'Put', 'Patch', 'Delete', 'All', 'Options', 'Head'].includes(name(d, file)));
        if (!route) continue;
        routes++;
        const labels = `${path.relative('.', filename)}:${file.getLineAndCharacterOfPosition(method.pos).line + 1} ${method.name.getText(file)}`;
        const policy = [...methodDecorators, ...classDecorators];
        const matches = (which) => policy.filter((d) => name(d, file) === which);
        const publicPolicy = matches('Public').length > 0;
        const selfPolicy = matches('Authenticated').length > 0;
        const grants = matches('RequirePermissions');
        const handlerGrants = methodDecorators.filter((d) => name(d, file) === 'RequirePermissions');
        const effectiveGrant = handlerGrants[0] ?? grants[0];
        const effectiveExpr = effectiveGrant?.expression;
        const effectiveArg = effectiveExpr && ts.isCallExpression(effectiveExpr) ? effectiveExpr.arguments[0] : null;
        const grantValues = effectiveArg && ts.isArrayLiteralExpression(effectiveArg)
          ? effectiveArg.elements : effectiveArg ? [effectiveArg] : [];
        const joinedGrants = grantValues.map((item) => ts.isStringLiteral(item) ? item.text : '[dynamic]');
        const permissionCall = effectiveExpr && ts.isCallExpression(effectiveExpr) ? effectiveExpr : null;
        const matchOr = permissionCall?.arguments[1]?.getText(file).includes("'OR'") ?? false;
        const routeExpr = route.expression;
        const routeCall = ts.isCallExpression(routeExpr) ? routeExpr : null;
        const routeArg = routeCall?.arguments[0];
        const suffix = routeArg && ts.isStringLiteral(routeArg) ? routeArg.text : routeArg ? '[dynamic]' : '';
        const url = `/${[prefix, suffix].filter(Boolean).join('/')}`.replace(/\/+/g, '/');
        matrix.push({ method: name(route, file).toUpperCase(), url,
          policy: publicPolicy ? 'Public' : effectiveGrant
            ? joinedGrants.join(matchOr ? ' OR ' : ' AND ') : selfPolicy ? 'Authenticated (self)' : 'MISSING',
          source: path.relative('.', filename) + ':' + (file.getLineAndCharacterOfPosition(method.pos).line + 1) });
        if (publicPolicy && (selfPolicy || grants.length)) errors.push(`${labels}: public route has another authorization policy`);
        if (!publicPolicy && !selfPolicy && !grants.length) errors.push(`${labels}: missing permission policy (default deny)`);
        if (publicPolicy) publicRoutes++;
        else if (grants.length) protectedRoutes++;
        else selfRoutes++;
        for (const decorator of grants) {
          const expr = decorator.expression;
          const arg = ts.isCallExpression(expr) ? expr.arguments[0] : null;
          const values = arg && ts.isArrayLiteralExpression(arg) ? arg.elements : arg ? [arg] : [];
          if (!values.length) errors.push(`${labels}: empty permission requirement`);
          for (const item of values) {
            if (!ts.isStringLiteral(item)) errors.push(`${labels}: dynamic permission requirement is not reviewable`);
            else if (!catalogue.has(item.text)) errors.push(`${labels}: unseeded permission ${item.text}`);
          }
        }
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(file);
}
visit(sourceDir);
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else if (process.argv.includes('--matrix')) {
  console.log('# Phase 11 endpoint authorization inventory — 2026-10-16');
  console.log('');
  console.log(`Generated by \`pnpm check:phase11:authz -- --matrix\` from controller decorators and seeded permission codes. ${routes} HTTP handlers: ${protectedRoutes} permission-gated, ${selfRoutes} authenticated-self, ${publicRoutes} public; zero missing/unseeded policies. Global JWT + permission guards enforce these policies server-side; a newly unannotated route is denied.`);
  console.log('');
  console.log('The paths below are relative to the global API prefix (`/api/v1` by default). `AND` requires all permissions; `OR` requires any. Public and authenticated-self are explicit exceptions. Static inspection does not replace runtime authorization/record-level tests (see the Phase 11 report).');
  console.log('');
  console.log('| Method | Path | Effective policy | Controller source |');
  console.log('| --- | --- | --- | --- |');
  for (const row of matrix.sort((a, b) => a.url.localeCompare(b.url) || a.method.localeCompare(b.method))) {
    console.log(`| ${row.method} | \`${row.url}\` | ${row.policy} | \`${row.source}\` |`);
  }
} else {
  console.log(`Authorization inventory: ${routes} HTTP handlers; ${protectedRoutes} permission-gated, ${selfRoutes} authenticated-self, ${publicRoutes} public; 0 missing policies or unseeded codes.`);
}
