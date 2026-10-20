-- ==========================================================================
-- source: 20260901162722_init
-- ==========================================================================
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "legalName" TEXT,
    "registrationNumber" TEXT,
    "taxNumber" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dubai',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "supportedCurrenciesJson" TEXT NOT NULL DEFAULT '["USD","AED"]',
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Port" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Port_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Yard" (
    "id" TEXT NOT NULL,
    "portId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Yard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "type" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "country" TEXT,
    "taxId" TEXT,
    "creditLimit" DECIMAL(18,2),
    "currency" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "Permission_module_idx" ON "Permission"("module");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");

-- CreateIndex
CREATE INDEX "Currency_isActive_idx" ON "Currency"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Port_code_key" ON "Port"("code");

-- CreateIndex
CREATE INDEX "Port_name_idx" ON "Port"("name");

-- CreateIndex
CREATE INDEX "Port_isActive_idx" ON "Port"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Yard_code_key" ON "Yard"("code");

-- CreateIndex
CREATE INDEX "Yard_portId_idx" ON "Yard"("portId");

-- CreateIndex
CREATE INDEX "Yard_isActive_idx" ON "Yard"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Customer_isActive_idx" ON "Customer"("isActive");

-- CreateIndex
CREATE INDEX "Customer_type_idx" ON "Customer"("type");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Yard" ADD CONSTRAINT "Yard_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20260902210635_phase2_auth_rbac
-- ==========================================================================
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedByTokenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20260902225307_phase3_master_data_indexes
-- ==========================================================================
-- Phase 3 — master-data search/filter indexes
-- Supports exact-match country and active filters on Ports,
-- and complements the existing unique code indexes.

CREATE INDEX "Port_country_idx" ON "Port"("country");

-- ==========================================================================
-- source: 20260903004915_phase2_refresh_lookup
-- ==========================================================================
-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "lookupKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_lookupKey_key" ON "RefreshToken"("lookupKey");

-- ==========================================================================
-- source: 20260903032523_phase4_cargo_yard_inventory
-- ==========================================================================
-- CreateEnum
CREATE TYPE "CargoStatus" AS ENUM ('REGISTERED', 'AT_YARD', 'READY', 'LOADED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CargoType" AS ENUM ('GENERAL', 'VEHICLE', 'HEAVY_LIFT', 'CONTAINER', 'BULK', 'PROJECT');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LoadingStatus" AS ENUM ('NOT_LOADED', 'LOADED');

-- CreateEnum
CREATE TYPE "WeightUnit" AS ENUM ('KG', 'MT');

-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('IN_YARD', 'RESERVED');

-- CreateTable
CREATE TABLE "Cargo" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "portId" TEXT NOT NULL,
    "yardId" TEXT,
    "destinationPortId" TEXT,
    "cargoType" "CargoType" NOT NULL,
    "specification" TEXT,
    "serialNumber" TEXT,
    "chassisNumber" TEXT,
    "vin" TEXT,
    "weight" DECIMAL(18,2),
    "weightUnit" "WeightUnit",
    "quantity" INTEGER,
    "packages" INTEGER,
    "packageType" TEXT,
    "arrivalDate" TIMESTAMP(3),
    "arrivalReference" TEXT,
    "inspectionStatus" "InspectionStatus" NOT NULL DEFAULT 'PENDING',
    "loadingStatus" "LoadingStatus" NOT NULL DEFAULT 'NOT_LOADED',
    "manifestNumber" TEXT,
    "status" "CargoStatus" NOT NULL DEFAULT 'REGISTERED',
    "comments" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YardInventory" (
    "id" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "yardId" TEXT NOT NULL,
    "portId" TEXT NOT NULL,
    "status" "InventoryStatus" NOT NULL DEFAULT 'IN_YARD',
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationLabel" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YardInventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cargo_reference_key" ON "Cargo"("reference");

-- CreateIndex
CREATE INDEX "Cargo_customerId_idx" ON "Cargo"("customerId");

-- CreateIndex
CREATE INDEX "Cargo_portId_idx" ON "Cargo"("portId");

-- CreateIndex
CREATE INDEX "Cargo_yardId_idx" ON "Cargo"("yardId");

-- CreateIndex
CREATE INDEX "Cargo_destinationPortId_idx" ON "Cargo"("destinationPortId");

-- CreateIndex
CREATE INDEX "Cargo_status_idx" ON "Cargo"("status");

-- CreateIndex
CREATE INDEX "Cargo_inspectionStatus_idx" ON "Cargo"("inspectionStatus");

-- CreateIndex
CREATE INDEX "Cargo_cargoType_idx" ON "Cargo"("cargoType");

-- CreateIndex
CREATE INDEX "Cargo_serialNumber_idx" ON "Cargo"("serialNumber");

-- CreateIndex
CREATE INDEX "Cargo_chassisNumber_idx" ON "Cargo"("chassisNumber");

-- CreateIndex
CREATE INDEX "Cargo_vin_idx" ON "Cargo"("vin");

-- CreateIndex
CREATE INDEX "Cargo_arrivalDate_idx" ON "Cargo"("arrivalDate");

-- CreateIndex
CREATE UNIQUE INDEX "YardInventory_cargoId_key" ON "YardInventory"("cargoId");

-- CreateIndex
CREATE INDEX "YardInventory_yardId_idx" ON "YardInventory"("yardId");

-- CreateIndex
CREATE INDEX "YardInventory_portId_idx" ON "YardInventory"("portId");

-- CreateIndex
CREATE INDEX "YardInventory_status_idx" ON "YardInventory"("status");

-- CreateIndex
CREATE INDEX "YardInventory_enteredAt_idx" ON "YardInventory"("enteredAt");

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_destinationPortId_fkey" FOREIGN KEY ("destinationPortId") REFERENCES "Port"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_yardId_fkey" FOREIGN KEY ("yardId") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YardInventory" ADD CONSTRAINT "YardInventory_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YardInventory" ADD CONSTRAINT "YardInventory_yardId_fkey" FOREIGN KEY ("yardId") REFERENCES "Yard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YardInventory" ADD CONSTRAINT "YardInventory_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ==========================================================================
-- source: 20260903032525_phase5_inspection_management
-- ==========================================================================
-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "inspectionNumber" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "status" "InspectionStatus" NOT NULL DEFAULT 'PENDING',
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "inspectorId" TEXT,
    "inspectorName" TEXT,
    "findings" TEXT,
    "condition" TEXT,
    "verificationNotes" TEXT,
    "remarks" TEXT,
    "rejectionReason" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_inspectionNumber_key" ON "Inspection"("inspectionNumber");

-- CreateIndex
CREATE INDEX "Inspection_cargoId_idx" ON "Inspection"("cargoId");

-- CreateIndex
CREATE INDEX "Inspection_status_idx" ON "Inspection"("status");

-- CreateIndex
CREATE INDEX "Inspection_inspectionDate_idx" ON "Inspection"("inspectionDate");

-- CreateIndex
CREATE INDEX "Inspection_inspectorId_idx" ON "Inspection"("inspectorId");

-- CreateIndex
CREATE INDEX "Inspection_createdById_idx" ON "Inspection"("createdById");

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique index: at most one PENDING inspection per cargo. Backs the
-- duplicate-pending-prevention rule in the service; keeps concurrent creates safe.
-- (Postgres allows multiple rows per cargo as long as at most one has status=PENDING.)
CREATE UNIQUE INDEX "Inspection_one_pending_per_cargo_idx"
ON "Inspection"("cargoId") WHERE "status" = 'PENDING';

-- ==========================================================================
-- source: 20260903043000_phase6_vessel_voyage
-- ==========================================================================
-- CreateEnum
CREATE TYPE "VesselType" AS ENUM ('CONTAINER', 'BULK', 'TANKER', 'RORO', 'GENERAL', 'PROJECT', 'OTHER');

-- CreateEnum
CREATE TYPE "VoyageStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Vessel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imo" TEXT,
    "flag" TEXT NOT NULL,
    "vesselType" "VesselType" NOT NULL,
    "capacityTeu" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Vessel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voyage" (
    "id" TEXT NOT NULL,
    "voyageNumber" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "status" "VoyageStatus" NOT NULL DEFAULT 'DRAFT',
    "originPortId" TEXT NOT NULL,
    "destinationPortId" TEXT NOT NULL,
    "plannedDepartureAt" TIMESTAMP(3),
    "plannedArrivalAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voyage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vessel_code_key" ON "Vessel"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Vessel_imo_key" ON "Vessel"("imo");

-- CreateIndex
CREATE INDEX "Vessel_code_idx" ON "Vessel"("code");

-- CreateIndex
CREATE INDEX "Vessel_name_idx" ON "Vessel"("name");

-- CreateIndex
CREATE INDEX "Vessel_flag_idx" ON "Vessel"("flag");

-- CreateIndex
CREATE INDEX "Vessel_vesselType_idx" ON "Vessel"("vesselType");

-- CreateIndex
CREATE INDEX "Vessel_isActive_idx" ON "Vessel"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Voyage_voyageNumber_key" ON "Voyage"("voyageNumber");

-- CreateIndex
CREATE INDEX "Voyage_voyageNumber_idx" ON "Voyage"("voyageNumber");

-- CreateIndex
CREATE INDEX "Voyage_vesselId_idx" ON "Voyage"("vesselId");

-- CreateIndex
CREATE INDEX "Voyage_status_idx" ON "Voyage"("status");

-- CreateIndex
CREATE INDEX "Voyage_originPortId_idx" ON "Voyage"("originPortId");

-- CreateIndex
CREATE INDEX "Voyage_destinationPortId_idx" ON "Voyage"("destinationPortId");

-- CreateIndex
CREATE INDEX "Voyage_plannedDepartureAt_idx" ON "Voyage"("plannedDepartureAt");

-- CreateIndex
CREATE INDEX "Voyage_plannedArrivalAt_idx" ON "Voyage"("plannedArrivalAt");

-- CreateIndex
CREATE INDEX "Voyage_createdAt_idx" ON "Voyage"("createdAt");

-- AddForeignKey
ALTER TABLE "Voyage" ADD CONSTRAINT "Voyage_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voyage" ADD CONSTRAINT "Voyage_originPortId_fkey" FOREIGN KEY ("originPortId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voyage" ADD CONSTRAINT "Voyage_destinationPortId_fkey" FOREIGN KEY ("destinationPortId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voyage" ADD CONSTRAINT "Voyage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ==========================================================================
-- source: 20260904120000_phase7_load_planning
-- ==========================================================================
-- CreateEnum
CREATE TYPE "LoadListStatus" AS ENUM ('DRAFT', 'FINALIZED', 'CANCELLED');

-- CreateTable
CREATE TABLE "LoadList" (
    "id" TEXT NOT NULL,
    "loadListNumber" TEXT NOT NULL,
    "voyageId" TEXT NOT NULL,
    "status" "LoadListStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" TEXT,
    "finalizedById" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LoadList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadListItem" (
    "id" TEXT NOT NULL,
    "loadListId" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "plannedQuantity" INTEGER,
    "sequence" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoadListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoadList_loadListNumber_key" ON "LoadList"("loadListNumber");

-- CreateIndex
CREATE INDEX "LoadList_voyageId_idx" ON "LoadList"("voyageId");

-- CreateIndex
CREATE INDEX "LoadList_status_idx" ON "LoadList"("status");

-- CreateIndex
CREATE INDEX "LoadList_createdAt_idx" ON "LoadList"("createdAt");

-- CreateIndex
CREATE INDEX "LoadList_createdById_idx" ON "LoadList"("createdById");

-- CreateIndex
CREATE INDEX "LoadListItem_loadListId_idx" ON "LoadListItem"("loadListId");

-- CreateIndex
CREATE INDEX "LoadListItem_cargoId_idx" ON "LoadListItem"("cargoId");

-- CreateIndex
CREATE INDEX "LoadListItem_sequence_idx" ON "LoadListItem"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "LoadListItem_loadListId_cargoId_key" ON "LoadListItem"("loadListId", "cargoId");

-- AddForeignKey
ALTER TABLE "LoadList" ADD CONSTRAINT "LoadList_voyageId_fkey" FOREIGN KEY ("voyageId") REFERENCES "Voyage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadList" ADD CONSTRAINT "LoadList_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadList" ADD CONSTRAINT "LoadList_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadList" ADD CONSTRAINT "LoadList_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadListItem" ADD CONSTRAINT "LoadListItem_loadListId_fkey" FOREIGN KEY ("loadListId") REFERENCES "LoadList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadListItem" ADD CONSTRAINT "LoadListItem_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20260909030420_phase8_actual_loading
-- ==========================================================================
-- CreateEnum
CREATE TYPE "ActualLoadingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LoadingResult" AS ENUM ('FULL', 'PARTIAL', 'NOT_LOADED');

-- CreateTable
CREATE TABLE "ActualLoading" (
    "id" TEXT NOT NULL,
    "actualLoadingNumber" TEXT NOT NULL,
    "loadListId" TEXT NOT NULL,
    "status" "ActualLoadingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "createdById" TEXT,
    "completedById" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ActualLoading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActualLoadingItem" (
    "id" TEXT NOT NULL,
    "actualLoadingId" TEXT NOT NULL,
    "loadListItemId" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "actualQuantity" INTEGER,
    "result" "LoadingResult" NOT NULL DEFAULT 'NOT_LOADED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActualLoadingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActualLoading_actualLoadingNumber_key" ON "ActualLoading"("actualLoadingNumber");

-- CreateIndex
CREATE INDEX "ActualLoading_actualLoadingNumber_idx" ON "ActualLoading"("actualLoadingNumber");

-- CreateIndex
CREATE INDEX "ActualLoading_loadListId_idx" ON "ActualLoading"("loadListId");

-- CreateIndex
CREATE INDEX "ActualLoading_status_idx" ON "ActualLoading"("status");

-- CreateIndex
CREATE INDEX "ActualLoading_createdAt_idx" ON "ActualLoading"("createdAt");

-- CreateIndex
CREATE INDEX "ActualLoading_createdById_idx" ON "ActualLoading"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ActualLoading_loadListId_key" ON "ActualLoading"("loadListId");

-- CreateIndex
CREATE UNIQUE INDEX "ActualLoadingItem_loadListItemId_key" ON "ActualLoadingItem"("loadListItemId");

-- CreateIndex
CREATE INDEX "ActualLoadingItem_actualLoadingId_idx" ON "ActualLoadingItem"("actualLoadingId");

-- CreateIndex
CREATE INDEX "ActualLoadingItem_loadListItemId_idx" ON "ActualLoadingItem"("loadListItemId");

-- CreateIndex
CREATE INDEX "ActualLoadingItem_cargoId_idx" ON "ActualLoadingItem"("cargoId");

-- CreateIndex
CREATE UNIQUE INDEX "ActualLoadingItem_actualLoadingId_loadListItemId_key" ON "ActualLoadingItem"("actualLoadingId", "loadListItemId");

-- CreateIndex
CREATE INDEX "LoadList_loadListNumber_idx" ON "LoadList"("loadListNumber");

-- AddForeignKey
ALTER TABLE "ActualLoading" ADD CONSTRAINT "ActualLoading_loadListId_fkey" FOREIGN KEY ("loadListId") REFERENCES "LoadList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualLoading" ADD CONSTRAINT "ActualLoading_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualLoading" ADD CONSTRAINT "ActualLoading_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualLoading" ADD CONSTRAINT "ActualLoading_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualLoadingItem" ADD CONSTRAINT "ActualLoadingItem_actualLoadingId_fkey" FOREIGN KEY ("actualLoadingId") REFERENCES "ActualLoading"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualLoadingItem" ADD CONSTRAINT "ActualLoadingItem_loadListItemId_fkey" FOREIGN KEY ("loadListItemId") REFERENCES "LoadListItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualLoadingItem" ADD CONSTRAINT "ActualLoadingItem_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20260911224819_phase9_manifest
-- ==========================================================================
-- CreateEnum
CREATE TYPE "ManifestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "manifests" (
    "id" TEXT NOT NULL,
    "manifestNumber" TEXT NOT NULL,
    "voyageId" TEXT NOT NULL,
    "status" "ManifestStatus" NOT NULL DEFAULT 'DRAFT',
    "vesselName" TEXT NOT NULL,
    "vesselImo" TEXT,
    "polPortId" TEXT NOT NULL,
    "podPortId" TEXT NOT NULL,
    "shipperId" TEXT,
    "consigneeId" TEXT,
    "agentId" TEXT,
    "notifyParty" TEXT,
    "description" TEXT,
    "gasCost" DECIMAL(18,2),
    "lashingCost" DECIMAL(18,2),
    "shipperCost" DECIMAL(18,2),
    "podCost" DECIMAL(18,2),
    "polCost" DECIMAL(18,2),
    "currencyCode" TEXT,
    "totalWeight" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "totalPackages" INTEGER NOT NULL DEFAULT 0,
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "submittedById" TEXT,
    "approvedById" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "manifests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manifest_items" (
    "id" TEXT NOT NULL,
    "manifestId" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "blNumber" TEXT,
    "weight" DECIMAL(18,3),
    "quantity" INTEGER,
    "packages" INTEGER,
    "packageType" TEXT,
    "notes" TEXT,
    "actualLoadingItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manifest_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manifests_manifestNumber_key" ON "manifests"("manifestNumber");

-- CreateIndex
CREATE INDEX "manifests_manifestNumber_idx" ON "manifests"("manifestNumber");

-- CreateIndex
CREATE INDEX "manifests_status_idx" ON "manifests"("status");

-- CreateIndex
CREATE INDEX "manifests_polPortId_idx" ON "manifests"("polPortId");

-- CreateIndex
CREATE INDEX "manifests_podPortId_idx" ON "manifests"("podPortId");

-- CreateIndex
CREATE INDEX "manifests_shipperId_idx" ON "manifests"("shipperId");

-- CreateIndex
CREATE INDEX "manifests_consigneeId_idx" ON "manifests"("consigneeId");

-- CreateIndex
CREATE INDEX "manifests_createdAt_idx" ON "manifests"("createdAt");

-- CreateIndex
CREATE INDEX "manifests_createdById_idx" ON "manifests"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "manifests_voyageId_key" ON "manifests"("voyageId");

-- CreateIndex
CREATE UNIQUE INDEX "manifest_items_actualLoadingItemId_key" ON "manifest_items"("actualLoadingItemId");

-- CreateIndex
CREATE INDEX "manifest_items_manifestId_idx" ON "manifest_items"("manifestId");

-- CreateIndex
CREATE INDEX "manifest_items_cargoId_idx" ON "manifest_items"("cargoId");

-- CreateIndex
CREATE INDEX "manifest_items_sequence_idx" ON "manifest_items"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "manifest_items_manifestId_cargoId_key" ON "manifest_items"("manifestId", "cargoId");

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_voyageId_fkey" FOREIGN KEY ("voyageId") REFERENCES "Voyage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_polPortId_fkey" FOREIGN KEY ("polPortId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_podPortId_fkey" FOREIGN KEY ("podPortId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_consigneeId_fkey" FOREIGN KEY ("consigneeId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifest_items" ADD CONSTRAINT "manifest_items_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "manifests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifest_items" ADD CONSTRAINT "manifest_items_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20260912002614_manifest_voyage_unique_softdelete
-- ==========================================================================
-- DropIndex
DROP INDEX "manifests_voyageId_key";

-- CreateIndex
CREATE INDEX "manifests_voyageId_idx" ON "manifests"("voyageId");

-- ==========================================================================
-- source: 20260912130959_phase10_bills_of_lading
-- ==========================================================================
-- CreateEnum
CREATE TYPE "BlStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BlType" AS ENUM ('MASTER', 'HOUSE');

-- CreateEnum
CREATE TYPE "FreightTerms" AS ENUM ('PREPAID', 'COLLECT');

-- CreateTable
CREATE TABLE "bills_of_lading" (
    "id" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "manifestId" TEXT NOT NULL,
    "voyageId" TEXT NOT NULL,
    "status" "BlStatus" NOT NULL DEFAULT 'DRAFT',
    "billType" "BlType" NOT NULL DEFAULT 'HOUSE',
    "vesselName" TEXT NOT NULL,
    "vesselImo" TEXT,
    "shipperId" TEXT,
    "consigneeId" TEXT,
    "notifyParty" TEXT,
    "freightTerms" "FreightTerms",
    "carrierName" TEXT,
    "placeOfIssue" TEXT,
    "dateOfIssue" TIMESTAMP(3),
    "originals" INTEGER,
    "freightAmount" DECIMAL(18,2),
    "currencyCode" TEXT,
    "goodsDescription" TEXT,
    "shipmentMarks" TEXT,
    "totalPackages" INTEGER NOT NULL DEFAULT 0,
    "totalGrossWeight" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "totalVolume" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "issuedById" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "bills_of_lading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills_of_lading_items" (
    "id" TEXT NOT NULL,
    "billOfLadingId" TEXT NOT NULL,
    "manifestItemId" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "goodsDescription" TEXT,
    "marksAndNumbers" TEXT,
    "packages" INTEGER,
    "packageType" TEXT,
    "grossWeight" DECIMAL(18,3),
    "volume" DECIMAL(18,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_of_lading_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bills_of_lading_billNumber_key" ON "bills_of_lading"("billNumber");

-- CreateIndex
CREATE INDEX "bills_of_lading_manifestId_idx" ON "bills_of_lading"("manifestId");

-- CreateIndex
CREATE INDEX "bills_of_lading_voyageId_idx" ON "bills_of_lading"("voyageId");

-- CreateIndex
CREATE INDEX "bills_of_lading_status_idx" ON "bills_of_lading"("status");

-- CreateIndex
CREATE INDEX "bills_of_lading_shipperId_idx" ON "bills_of_lading"("shipperId");

-- CreateIndex
CREATE INDEX "bills_of_lading_consigneeId_idx" ON "bills_of_lading"("consigneeId");

-- CreateIndex
CREATE INDEX "bills_of_lading_createdAt_idx" ON "bills_of_lading"("createdAt");

-- CreateIndex
CREATE INDEX "bills_of_lading_createdById_idx" ON "bills_of_lading"("createdById");

-- CreateIndex
CREATE INDEX "bills_of_lading_items_billOfLadingId_idx" ON "bills_of_lading_items"("billOfLadingId");

-- CreateIndex
CREATE INDEX "bills_of_lading_items_manifestItemId_idx" ON "bills_of_lading_items"("manifestItemId");

-- CreateIndex
CREATE INDEX "bills_of_lading_items_cargoId_idx" ON "bills_of_lading_items"("cargoId");

-- AddForeignKey
ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "manifests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_voyageId_fkey" FOREIGN KEY ("voyageId") REFERENCES "Voyage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_consigneeId_fkey" FOREIGN KEY ("consigneeId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading_items" ADD CONSTRAINT "bills_of_lading_items_billOfLadingId_fkey" FOREIGN KEY ("billOfLadingId") REFERENCES "bills_of_lading"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading_items" ADD CONSTRAINT "bills_of_lading_items_manifestItemId_fkey" FOREIGN KEY ("manifestItemId") REFERENCES "manifest_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading_items" ADD CONSTRAINT "bills_of_lading_items_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20260912175229_phase11_invoices
-- ==========================================================================
-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "manifestId" TEXT,
    "billOfLadingId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "issueDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "issuedById" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_customerId_idx" ON "invoices"("customerId");

-- CreateIndex
CREATE INDEX "invoices_manifestId_idx" ON "invoices"("manifestId");

-- CreateIndex
CREATE INDEX "invoices_billOfLadingId_idx" ON "invoices"("billOfLadingId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_issueDate_idx" ON "invoices"("issueDate");

-- CreateIndex
CREATE INDEX "invoices_dueDate_idx" ON "invoices"("dueDate");

-- CreateIndex
CREATE INDEX "invoices_createdAt_idx" ON "invoices"("createdAt");

-- CreateIndex
CREATE INDEX "invoices_createdById_idx" ON "invoices"("createdById");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_items_sequence_idx" ON "invoice_items"("sequence");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "manifests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billOfLadingId_fkey" FOREIGN KEY ("billOfLadingId") REFERENCES "bills_of_lading"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20260912175522_phase11_invoice_totals
-- ==========================================================================
-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "unitPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
ALTER COLUMN "amount" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- ==========================================================================
-- source: 20260912175813_phase11_invoice_voyage
-- ==========================================================================
-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "voyageId" TEXT;

-- CreateIndex
CREATE INDEX "invoices_voyageId_idx" ON "invoices"("voyageId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_voyageId_fkey" FOREIGN KEY ("voyageId") REFERENCES "Voyage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20260912180341_phase11_invoice_title_nullable
-- ==========================================================================
-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "title" DROP NOT NULL;

-- ==========================================================================
-- source: 20260912190203_phase12_vouchers
-- ==========================================================================
-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('RECEIPT', 'PAYMENT');

-- CreateEnum
CREATE TYPE "VoucherMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('POSTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "type" "VoucherType" NOT NULL,
    "status" "VoucherStatus" NOT NULL DEFAULT 'POSTED',
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "voyageId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "exchangeRate" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "method" "VoucherMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "description" TEXT,
    "note" TEXT,
    "voucherDate" TIMESTAMP(3) NOT NULL,
    "cancelReason" TEXT,
    "createdById" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_voucherNumber_key" ON "vouchers"("voucherNumber");

-- CreateIndex
CREATE INDEX "vouchers_customerId_idx" ON "vouchers"("customerId");

-- CreateIndex
CREATE INDEX "vouchers_invoiceId_idx" ON "vouchers"("invoiceId");

-- CreateIndex
CREATE INDEX "vouchers_voyageId_idx" ON "vouchers"("voyageId");

-- CreateIndex
CREATE INDEX "vouchers_type_idx" ON "vouchers"("type");

-- CreateIndex
CREATE INDEX "vouchers_status_idx" ON "vouchers"("status");

-- CreateIndex
CREATE INDEX "vouchers_voucherDate_idx" ON "vouchers"("voucherDate");

-- CreateIndex
CREATE INDEX "vouchers_createdAt_idx" ON "vouchers"("createdAt");

-- CreateIndex
CREATE INDEX "vouchers_createdById_idx" ON "vouchers"("createdById");

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20260912194439_phase13_delivery_release_orders
-- ==========================================================================
-- CreateEnum
CREATE TYPE "DeliveryOrderStatus" AS ENUM ('ISSUED', 'CANCELLED');

-- CreateTable
CREATE TABLE "delivery_orders" (
    "id" TEXT NOT NULL,
    "docNumber" TEXT NOT NULL,
    "billOfLadingId" TEXT NOT NULL,
    "status" "DeliveryOrderStatus" NOT NULL DEFAULT 'ISSUED',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipient" TEXT NOT NULL,
    "recipientId" TEXT,
    "vehiclePlate" TEXT,
    "notes" TEXT,
    "cancelReason" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "delivery_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_orders" (
    "id" TEXT NOT NULL,
    "docNumber" TEXT NOT NULL,
    "billOfLadingId" TEXT NOT NULL,
    "status" "DeliveryOrderStatus" NOT NULL DEFAULT 'ISSUED',
    "releaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "financialOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "notes" TEXT,
    "cancelReason" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "release_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_orders_docNumber_key" ON "delivery_orders"("docNumber");

-- CreateIndex
CREATE INDEX "delivery_orders_billOfLadingId_idx" ON "delivery_orders"("billOfLadingId");

-- CreateIndex
CREATE INDEX "delivery_orders_status_idx" ON "delivery_orders"("status");

-- CreateIndex
CREATE INDEX "delivery_orders_issueDate_idx" ON "delivery_orders"("issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "release_orders_docNumber_key" ON "release_orders"("docNumber");

-- CreateIndex
CREATE INDEX "release_orders_billOfLadingId_idx" ON "release_orders"("billOfLadingId");

-- CreateIndex
CREATE INDEX "release_orders_status_idx" ON "release_orders"("status");

-- CreateIndex
CREATE INDEX "release_orders_releaseDate_idx" ON "release_orders"("releaseDate");

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_billOfLadingId_fkey" FOREIGN KEY ("billOfLadingId") REFERENCES "bills_of_lading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_orders" ADD CONSTRAINT "release_orders_billOfLadingId_fkey" FOREIGN KEY ("billOfLadingId") REFERENCES "bills_of_lading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_orders" ADD CONSTRAINT "release_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_orders" ADD CONSTRAINT "release_orders_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20260912233657_phase14_proforma
-- ==========================================================================
-- CreateEnum
CREATE TYPE "ProformaStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- CreateTable
CREATE TABLE "proformas" (
    "id" TEXT NOT NULL,
    "proformaNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "ProformaStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "description" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "issueDate" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "linkedInvoiceId" TEXT,
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "issuedById" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "proformas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proforma_items" (
    "id" TEXT NOT NULL,
    "proformaId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proforma_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proformas_proformaNumber_key" ON "proformas"("proformaNumber");

-- CreateIndex
CREATE UNIQUE INDEX "proformas_linkedInvoiceId_key" ON "proformas"("linkedInvoiceId");

-- CreateIndex
CREATE INDEX "proformas_customerId_idx" ON "proformas"("customerId");

-- CreateIndex
CREATE INDEX "proformas_status_idx" ON "proformas"("status");

-- CreateIndex
CREATE INDEX "proformas_issueDate_idx" ON "proformas"("issueDate");

-- CreateIndex
CREATE INDEX "proformas_createdAt_idx" ON "proformas"("createdAt");

-- CreateIndex
CREATE INDEX "proforma_items_proformaId_idx" ON "proforma_items"("proformaId");

-- CreateIndex
CREATE INDEX "proforma_items_sequence_idx" ON "proforma_items"("sequence");

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_linkedInvoiceId_fkey" FOREIGN KEY ("linkedInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_items" ADD CONSTRAINT "proforma_items_proformaId_fkey" FOREIGN KEY ("proformaId") REFERENCES "proformas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20260913005121_phase15_quotations
-- ==========================================================================
-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "description" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "issueDate" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "linkedProformaId" TEXT,
    "rejectReason" TEXT,
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "sentById" TEXT,
    "acceptedById" TEXT,
    "rejectedById" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotations_quotationNumber_key" ON "quotations"("quotationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_linkedProformaId_key" ON "quotations"("linkedProformaId");

-- CreateIndex
CREATE INDEX "quotations_customerId_idx" ON "quotations"("customerId");

-- CreateIndex
CREATE INDEX "quotations_status_idx" ON "quotations"("status");

-- CreateIndex
CREATE INDEX "quotations_issueDate_idx" ON "quotations"("issueDate");

-- CreateIndex
CREATE INDEX "quotations_createdAt_idx" ON "quotations"("createdAt");

-- CreateIndex
CREATE INDEX "quotation_items_quotationId_idx" ON "quotation_items"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_items_sequence_idx" ON "quotation_items"("sequence");

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_linkedProformaId_fkey" FOREIGN KEY ("linkedProformaId") REFERENCES "proformas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20260913020735_phase16_salary
-- ==========================================================================
-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SalaryStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nationalId" TEXT,
    "position" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "hireDate" DATE,
    "baseSalary" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_records" (
    "id" TEXT NOT NULL,
    "recordNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "SalaryStatus" NOT NULL DEFAULT 'DRAFT',
    "base" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "additions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "paymentMethod" "VoucherMethod",
    "paymentRef" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidById" TEXT,
    "paidAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "salary_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_code_key" ON "employees"("code");

-- CreateIndex
CREATE UNIQUE INDEX "salary_records_recordNumber_key" ON "salary_records"("recordNumber");

-- CreateIndex
CREATE INDEX "salary_records_year_month_idx" ON "salary_records"("year", "month");

-- CreateIndex
CREATE INDEX "salary_records_status_idx" ON "salary_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "salary_records_employeeId_year_month_key" ON "salary_records"("employeeId", "year", "month");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_records" ADD CONSTRAINT "salary_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_records" ADD CONSTRAINT "salary_records_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_records" ADD CONSTRAINT "salary_records_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_records" ADD CONSTRAINT "salary_records_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_records" ADD CONSTRAINT "salary_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20260913040329_phase17_letters
-- ==========================================================================
-- CreateEnum
CREATE TYPE "LetterDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "LetterStatus" AS ENUM ('DRAFT', 'SENT', 'RECEIVED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "letters" (
    "id" TEXT NOT NULL,
    "letterNumber" TEXT NOT NULL,
    "direction" "LetterDirection" NOT NULL,
    "status" "LetterStatus" NOT NULL DEFAULT 'DRAFT',
    "letterDate" TIMESTAMP(3) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body" TEXT,
    "refNumber" VARCHAR(100),
    "fromContact" VARCHAR(160),
    "toContact" VARCHAR(160),
    "customerId" TEXT,
    "replyToId" TEXT,
    "notes" VARCHAR(500),
    "sentById" TEXT,
    "sentAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "letters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "letters_letterNumber_key" ON "letters"("letterNumber");

-- CreateIndex
CREATE INDEX "letters_status_idx" ON "letters"("status");

-- CreateIndex
CREATE INDEX "letters_direction_idx" ON "letters"("direction");

-- CreateIndex
CREATE INDEX "letters_letterDate_idx" ON "letters"("letterDate");

-- CreateIndex
CREATE INDEX "letters_customerId_idx" ON "letters"("customerId");

-- CreateIndex
CREATE INDEX "letters_replyToId_idx" ON "letters"("replyToId");

-- AddForeignKey
ALTER TABLE "letters" ADD CONSTRAINT "letters_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters" ADD CONSTRAINT "letters_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "letters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters" ADD CONSTRAINT "letters_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters" ADD CONSTRAINT "letters_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters" ADD CONSTRAINT "letters_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20260913184816_phase18_jobs
-- ==========================================================================
-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'OPEN', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobItemKind" AS ENUM ('COST', 'INCOME');

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "customerId" TEXT,
    "voyageId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "openingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelReason" VARCHAR(500),
    "notes" VARCHAR(500),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_cost_items" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" "JobItemKind" NOT NULL,
    "category" VARCHAR(60),
    "description" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "itemDate" TIMESTAMP(3),
    "notes" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_cost_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jobs_jobNumber_key" ON "jobs"("jobNumber");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_customerId_idx" ON "jobs"("customerId");

-- CreateIndex
CREATE INDEX "jobs_voyageId_idx" ON "jobs"("voyageId");

-- CreateIndex
CREATE INDEX "jobs_openingDate_idx" ON "jobs"("openingDate");

-- CreateIndex
CREATE INDEX "job_cost_items_jobId_idx" ON "job_cost_items"("jobId");

-- CreateIndex
CREATE INDEX "job_cost_items_kind_idx" ON "job_cost_items"("kind");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_voyageId_fkey" FOREIGN KEY ("voyageId") REFERENCES "Voyage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cost_items" ADD CONSTRAINT "job_cost_items_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20260913191119_phase18_jobs_jobtype
-- ==========================================================================
-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "jobType" VARCHAR(60);

-- ==========================================================================
-- source: 20260913200811_phase19_discharge
-- ==========================================================================
-- CreateEnum
CREATE TYPE "DischargeStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DischargeResult" AS ENUM ('NOT_DISCHARGED', 'FULL', 'PARTIAL');

-- CreateTable
CREATE TABLE "Discharge" (
    "id" TEXT NOT NULL,
    "dischargeNumber" TEXT NOT NULL,
    "actualLoadingId" TEXT NOT NULL,
    "status" "DischargeStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "createdById" TEXT,
    "completedById" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Discharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DischargeItem" (
    "id" TEXT NOT NULL,
    "dischargeId" TEXT NOT NULL,
    "actualLoadingItemId" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "expectedQuantity" INTEGER,
    "dischargeQuantity" INTEGER,
    "result" "DischargeResult" NOT NULL DEFAULT 'NOT_DISCHARGED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DischargeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Discharge_dischargeNumber_key" ON "Discharge"("dischargeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Discharge_actualLoadingId_key" ON "Discharge"("actualLoadingId");

-- CreateIndex
CREATE INDEX "Discharge_dischargeNumber_idx" ON "Discharge"("dischargeNumber");

-- CreateIndex
CREATE INDEX "Discharge_status_idx" ON "Discharge"("status");

-- CreateIndex
CREATE INDEX "Discharge_createdAt_idx" ON "Discharge"("createdAt");

-- CreateIndex
CREATE INDEX "Discharge_createdById_idx" ON "Discharge"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "DischargeItem_actualLoadingItemId_key" ON "DischargeItem"("actualLoadingItemId");

-- CreateIndex
CREATE INDEX "DischargeItem_dischargeId_idx" ON "DischargeItem"("dischargeId");

-- CreateIndex
CREATE INDEX "DischargeItem_cargoId_idx" ON "DischargeItem"("cargoId");

-- CreateIndex
CREATE INDEX "DischargeItem_actualLoadingItemId_idx" ON "DischargeItem"("actualLoadingItemId");

-- AddForeignKey
ALTER TABLE "Discharge" ADD CONSTRAINT "Discharge_actualLoadingId_fkey" FOREIGN KEY ("actualLoadingId") REFERENCES "ActualLoading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discharge" ADD CONSTRAINT "Discharge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discharge" ADD CONSTRAINT "Discharge_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discharge" ADD CONSTRAINT "Discharge_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeItem" ADD CONSTRAINT "DischargeItem_dischargeId_fkey" FOREIGN KEY ("dischargeId") REFERENCES "Discharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeItem" ADD CONSTRAINT "DischargeItem_actualLoadingItemId_fkey" FOREIGN KEY ("actualLoadingItemId") REFERENCES "ActualLoadingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeItem" ADD CONSTRAINT "DischargeItem_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20260913210526_phase20_agent_portal
-- ==========================================================================
-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "portalCustomerId" TEXT;

-- CreateTable
CREATE TABLE "booking_requests" (
    "id" TEXT NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "cargoDescription" TEXT NOT NULL,
    "originPortId" TEXT,
    "destinationPortId" TEXT,
    "requestedShipDate" TIMESTAMP(3),
    "containers" INTEGER,
    "weightKg" DECIMAL(18,3),
    "notes" TEXT,
    "responseNote" TEXT,
    "submittedById" TEXT,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "booking_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booking_requests_bookingNumber_key" ON "booking_requests"("bookingNumber");

-- CreateIndex
CREATE INDEX "booking_requests_customerId_idx" ON "booking_requests"("customerId");

-- CreateIndex
CREATE INDEX "booking_requests_bookingNumber_idx" ON "booking_requests"("bookingNumber");

-- CreateIndex
CREATE INDEX "booking_requests_status_idx" ON "booking_requests"("status");

-- CreateIndex
CREATE INDEX "booking_requests_createdAt_idx" ON "booking_requests"("createdAt");

-- CreateIndex
CREATE INDEX "booking_requests_submittedById_idx" ON "booking_requests"("submittedById");

-- CreateIndex
CREATE UNIQUE INDEX "User_portalCustomerId_key" ON "User"("portalCustomerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_portalCustomerId_fkey" FOREIGN KEY ("portalCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_originPortId_fkey" FOREIGN KEY ("originPortId") REFERENCES "Port"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_destinationPortId_fkey" FOREIGN KEY ("destinationPortId") REFERENCES "Port"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20260929132053_add_port_abbreviation_unique
-- ==========================================================================
-- Phase 2: Port.abbreviation — additive, non-destructive.

-- 1) Ensure the column exists as nullable text.
--    (Already present on the live DB from an out-of-band change; IF NOT EXISTS
--     keeps this safe on both the live database and a fresh replay.)
ALTER TABLE "Port" ADD COLUMN IF NOT EXISTS "abbreviation" TEXT;

-- 2) Drop the stray non-unique index on abbreviation (created outside Prisma;
--    not declared in schema.prisma, redundant once the unique index exists).
DROP INDEX IF EXISTS "Port_abbreviation_idx";

-- 3) Enforce uniqueness where a value is supplied (Postgres treats NULLs as
--    distinct, so ports without an abbreviation are unaffected).
CREATE UNIQUE INDEX IF NOT EXISTS "Port_abbreviation_key" ON "Port"("abbreviation");

-- ==========================================================================
-- source: 20260929142911_vessel_type_tug_barge
-- ==========================================================================
-- Phase 2 — Vessel type & tug/barge modeling.
-- docs/current-plan/01-final-requirements.md:56-57: "Vessel types include Tug,
-- Barge, Landing Craft, and regular Vessel. Tug and Barge may be recorded as a
-- pair with two names."
--
-- Additive and idempotent: every statement is guarded so this migration is a
-- no-op on the live database (where these objects already exist from an
-- out-of-band change by a prior execution) and applies cleanly on a fresh
-- replay of the migration history. No existing rows are rewritten; every
-- existing Vessel keeps the type it already has.

-- 1) Extend VesselType with the three categories the plan documents require
--    alongside the existing self-propelled categories (CONTAINER, BULK,
--    TANKER, RORO, GENERAL, PROJECT, OTHER). PostgreSQL >= 12 permits ADD
--    VALUE inside the migration transaction as long as the new values are not
--    used in the same transaction (they are not).
ALTER TYPE "VesselType" ADD VALUE IF NOT EXISTS 'TUG';
ALTER TYPE "VesselType" ADD VALUE IF NOT EXISTS 'BARGE';
ALTER TYPE "VesselType" ADD VALUE IF NOT EXISTS 'LANDING_CRAFT';

-- 2) Optional per-voyage tug/barge pairing (nullable FK columns; NULL means
--    the voyage is a plain self-propelled sailing — the shape every existing
--    voyage already has).
ALTER TABLE "Voyage" ADD COLUMN IF NOT EXISTS "tugVesselId" TEXT;
ALTER TABLE "Voyage" ADD COLUMN IF NOT EXISTS "bargeVesselId" TEXT;

-- 3) Indexes for the pairing columns (Prisma naming convention).
CREATE INDEX IF NOT EXISTS "Voyage_tugVesselId_idx" ON "Voyage"("tugVesselId");
CREATE INDEX IF NOT EXISTS "Voyage_bargeVesselId_idx" ON "Voyage"("bargeVesselId");

-- 4) Pairing foreign keys with the referential actions Prisma declares for
--    optional relations (ON DELETE SET NULL — deleting a tug/barge never
--    deletes the voyage; ON UPDATE CASCADE). Dropped and re-added so the live
--    database converges on the schema-declared definition; this touches only
--    the constraint, never row data.
ALTER TABLE "Voyage" DROP CONSTRAINT IF EXISTS "Voyage_tugVesselId_fkey";
ALTER TABLE "Voyage" ADD CONSTRAINT "Voyage_tugVesselId_fkey"
    FOREIGN KEY ("tugVesselId") REFERENCES "Vessel"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Voyage" DROP CONSTRAINT IF EXISTS "Voyage_bargeVesselId_fkey";
ALTER TABLE "Voyage" ADD CONSTRAINT "Voyage_bargeVesselId_fkey"
    FOREIGN KEY ("bargeVesselId") REFERENCES "Vessel"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ==========================================================================
-- source: 20260929164932_voyage_destination_legs
-- ==========================================================================
-- Phase 2 - Voyage per-destination numbering.
-- docs/current-plan/01-final-requirements.md:58-64: voyage numbering is per
-- destination (1/26, 2/26 per destination per year); 04-final-data-model.md:44.
--
-- Additive only: creates the VoyageDestination legs table, then backfills ONE
-- leg per existing voyage (legNumber = 1, voyageNumber = the existing parent
-- voyageNumber) so no historical number changes and no voyage row is rewritten.
-- Every statement is guarded so the migration is replay-safe (idempotent).

-- 1) Legs table
CREATE TABLE IF NOT EXISTS "VoyageDestination" (
    "id" TEXT NOT NULL,
    "voyageId" TEXT NOT NULL,
    "destinationPortId" TEXT NOT NULL,
    "legNumber" INTEGER NOT NULL,
    "voyageNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VoyageDestination_pkey" PRIMARY KEY ("id")
);

-- 2) Indexes (Prisma naming, from migrate diff)
CREATE INDEX IF NOT EXISTS "VoyageDestination_voyageId_idx" ON "VoyageDestination"("voyageId");
CREATE INDEX IF NOT EXISTS "VoyageDestination_destinationPortId_idx" ON "VoyageDestination"("destinationPortId");
CREATE INDEX IF NOT EXISTS "VoyageDestination_createdAt_idx" ON "VoyageDestination"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "VoyageDestination_destinationPortId_voyageNumber_key" ON "VoyageDestination"("destinationPortId", "voyageNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "VoyageDestination_voyageId_destinationPortId_key" ON "VoyageDestination"("voyageId", "destinationPortId");

-- 3) Foreign keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VoyageDestination_voyageId_fkey') THEN
        ALTER TABLE "VoyageDestination" ADD CONSTRAINT "VoyageDestination_voyageId_fkey"
            FOREIGN KEY ("voyageId") REFERENCES "Voyage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VoyageDestination_destinationPortId_fkey') THEN
        ALTER TABLE "VoyageDestination" ADD CONSTRAINT "VoyageDestination_destinationPortId_fkey"
            FOREIGN KEY ("destinationPortId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- 4) Backfill: one leg per voyage that has no leg yet (idempotent).
--    legNumber = 1, voyageNumber = the voyage's existing number (preserved).
INSERT INTO "VoyageDestination"
    ("id", "voyageId", "destinationPortId", "legNumber", "voyageNumber", "createdAt", "updatedAt")
SELECT
    replace(gen_random_uuid()::text, '-', ''),
    v."id",
    v."destinationPortId",
    1,
    v."voyageNumber",
    NOW(),
    NOW()
FROM "Voyage" v
WHERE NOT EXISTS (
    SELECT 1 FROM "VoyageDestination" vd WHERE vd."voyageId" = v."id"
);

-- ==========================================================================
-- source: 20260929212803_portal_agent_linkage
-- ==========================================================================
-- Phase 2 — Portal agent linkage (party-cutover-plan.md §3 addendum + §8 item 0).
--
-- ADDITIVE ONLY: adds User.portalAgentId (nullable, unique) FK -> Agent master.
-- User.portalCustomerId is retained unchanged (bookings/statement stay
-- Customer-scoped); portal manifest scoping moves to portalAgentId in code.
--
-- Guarded so the migration is replay-safe on this database AND complete on a
-- fresh replay:
--   * "agents" is declared here because it exists in NO migration file (pre-existing
--     replay gap; party-cutover-plan.md §9 records the same gap for the cutover
--     unit, whose guarded declaration then no-ops).
--   * column / unique index / FK use IF NOT EXISTS / pg_constraint guards.

-- 1) Agent master table (matches schema.prisma Agent model + live shape)
CREATE TABLE IF NOT EXISTS "agents" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Agent_code_key" ON "agents"("code");
CREATE INDEX IF NOT EXISTS "Agent_code_idx" ON "agents"("code");
CREATE INDEX IF NOT EXISTS "Agent_name_idx" ON "agents"("name");
CREATE INDEX IF NOT EXISTS "Agent_isActive_idx" ON "agents"("isActive");

-- 2) User.portalAgentId — nullable + unique (Prisma naming)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "portalAgentId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_portalAgentId_key" ON "User"("portalAgentId");

-- 3) FK -> Agent (Prisma default for an optional relation: SET NULL / CASCADE update)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_portalAgentId_fkey') THEN
        ALTER TABLE "User" ADD CONSTRAINT "User_portalAgentId_fkey"
            FOREIGN KEY ("portalAgentId") REFERENCES "agents"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- ==========================================================================
-- source: 20260929231625_party_cutover_party_fks
-- ==========================================================================
-- Phase 2 — B/L/Manifest party reference cutover (party-cutover-plan.md §2; task-unit 1).
--
-- Additive/declarative + repoint, non-destructive to rows:
--   1) declare shippers/consignees/agents guarded (pre-existing replay gap: these tables exist
--      in NO migration file — plan §9; "agents" is also declared by 20260929212803_portal_agent_linkage,
--      so its declaration here is a guarded no-op),
--   2) declare the Cargo party columns/indexes/FKs guarded (live already — replay-completeness
--      no-ops, plan §2.4 / evidence §1.4),
--   3) DROP the 5 old manifest/B-L party FKs to "Customer",
--   4) NULL the 12 unmigratable FK values (6 rows; pre-flight proved 0/12 match any master →
--      non-blocking; rows keep their free-text notifyParty),
--   5) ADD the new FKs to shippers/consignees/agents (Prisma naming, ON DELETE SET NULL /
--      ON UPDATE CASCADE — matches live defs captured in the log).
-- File order is drop → null → add (the validating order; plan §2.1–§2.3 is conceptual).

-- =========================================================================
-- 1) Master tables (exact live shape: 12 columns each)
-- =========================================================================
CREATE TABLE IF NOT EXISTS "shippers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Shipper_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Shipper_code_key" ON "shippers"("code");
CREATE INDEX IF NOT EXISTS "Shipper_code_idx" ON "shippers"("code");
CREATE INDEX IF NOT EXISTS "Shipper_name_idx" ON "shippers"("name");
CREATE INDEX IF NOT EXISTS "Shipper_isActive_idx" ON "shippers"("isActive");

CREATE TABLE IF NOT EXISTS "consignees" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Consignee_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Consignee_code_key" ON "consignees"("code");
CREATE INDEX IF NOT EXISTS "Consignee_code_idx" ON "consignees"("code");
CREATE INDEX IF NOT EXISTS "Consignee_name_idx" ON "consignees"("name");
CREATE INDEX IF NOT EXISTS "Consignee_isActive_idx" ON "consignees"("isActive");

CREATE TABLE IF NOT EXISTS "agents" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Agent_code_key" ON "agents"("code");
CREATE INDEX IF NOT EXISTS "Agent_code_idx" ON "agents"("code");
CREATE INDEX IF NOT EXISTS "Agent_name_idx" ON "agents"("name");
CREATE INDEX IF NOT EXISTS "Agent_isActive_idx" ON "agents"("isActive");

-- =========================================================================
-- 2) Cargo party FKs/columns (schema.prisma:424-425,463-464,479-480) — no-ops on live DB
-- =========================================================================
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "shipperId" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "consigneeId" TEXT;
CREATE INDEX IF NOT EXISTS "Cargo_shipperId_idx" ON "Cargo"("shipperId");
CREATE INDEX IF NOT EXISTS "Cargo_consigneeId_idx" ON "Cargo"("consigneeId");
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Cargo_shipperId_fkey') THEN
        ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_shipperId_fkey"
            FOREIGN KEY ("shipperId") REFERENCES "shippers"("id") ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Cargo_consigneeId_fkey') THEN
        ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_consigneeId_fkey"
            FOREIGN KEY ("consigneeId") REFERENCES "consignees"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- =========================================================================
-- 3) Drop the old party FKs to "Customer" (columns kept)
-- =========================================================================
ALTER TABLE "manifests" DROP CONSTRAINT IF EXISTS "manifests_shipperId_fkey";
ALTER TABLE "manifests" DROP CONSTRAINT IF EXISTS "manifests_consigneeId_fkey";
ALTER TABLE "manifests" DROP CONSTRAINT IF EXISTS "manifests_agentId_fkey";
ALTER TABLE "bills_of_lading" DROP CONSTRAINT IF EXISTS "bills_of_lading_shipperId_fkey";
ALTER TABLE "bills_of_lading" DROP CONSTRAINT IF EXISTS "bills_of_lading_consigneeId_fkey";

-- =========================================================================
-- 4) Null the unmigratable values (idempotent: second run matches 0 rows).
--    Pre-flight (this log): 12 non-null values across 6 rows, 0/12 match any
--    master under name/taxId/code heuristics → cannot be remapped; accepted
--    greenfield consequence (plan §1). notifyParty free text is untouched.
-- =========================================================================
UPDATE "manifests"
   SET "shipperId" = NULL, "consigneeId" = NULL, "agentId" = NULL
 WHERE "shipperId" IS NOT NULL OR "consigneeId" IS NOT NULL OR "agentId" IS NOT NULL;

UPDATE "bills_of_lading"
   SET "shipperId" = NULL, "consigneeId" = NULL
 WHERE "shipperId" IS NOT NULL OR "consigneeId" IS NOT NULL;

-- =========================================================================
-- 5) New FKs to the master tables (Prisma names reused)
-- =========================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manifests_shipperId_fkey') THEN
        ALTER TABLE "manifests" ADD CONSTRAINT "manifests_shipperId_fkey"
            FOREIGN KEY ("shipperId") REFERENCES "shippers"("id")
            ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manifests_consigneeId_fkey') THEN
        ALTER TABLE "manifests" ADD CONSTRAINT "manifests_consigneeId_fkey"
            FOREIGN KEY ("consigneeId") REFERENCES "consignees"("id")
            ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manifests_agentId_fkey') THEN
        ALTER TABLE "manifests" ADD CONSTRAINT "manifests_agentId_fkey"
            FOREIGN KEY ("agentId") REFERENCES "agents"("id")
            ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bills_of_lading_shipperId_fkey') THEN
        ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_shipperId_fkey"
            FOREIGN KEY ("shipperId") REFERENCES "shippers"("id")
            ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bills_of_lading_consigneeId_fkey') THEN
        ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_consigneeId_fkey"
            FOREIGN KEY ("consigneeId") REFERENCES "consignees"("id")
            ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- ==========================================================================
-- source: 20260930180000_replay_completeness
-- ==========================================================================
-- Phase 2 follow-up: migration-replay completeness.
--
-- Discovered while closing the reported `agent_destinations` gap: a fresh replay
-- of prisma/migrations does NOT reproduce prisma/schema.prisma. Verified with
--   npx prisma migrate diff --from-migrations prisma/migrations \
--       --to-schema-datamodel prisma/schema.prisma --shadow-database-url <shadow>
-- which reported 6 missing tables, 4 enum mismatches, 9 Cargo columns, 1
-- LoadListItem column, wrong constraint/index names and 2 FK definitions.
--
-- Everything below is guarded so that:
--   * on this live DB  -> the file is a near no-op (rows/indexes already match)
--   * on a fresh replay-> the resulting schema matches schema.prisma
-- No row data is written; enum rebuilds only run when the label set differs.

-- =========================================================================
-- 1) Enums
-- =========================================================================

-- 1a) LoadListItemSelectionStatus: absent from every migration file.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoadListItemSelectionStatus') THEN
    EXECUTE $q$CREATE TYPE "LoadListItemSelectionStatus" AS ENUM ('NOT_SELECTED', 'SELECTED', 'LOADED', 'NOT_LOADED')$q$;
  END IF;
END $$;

-- 1b) LoadListStatus: migrations create ('DRAFT','FINALIZED','CANCELLED') only.
DO $$
DECLARE
  v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['IN_PROGRESS', 'PARTIALLY_LOADED', 'COMPLETED'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'LoadListStatus' AND e.enumlabel = v
    ) THEN
      EXECUTE format('ALTER TYPE "LoadListStatus" ADD VALUE %L', v);
    END IF;
  END LOOP;
END $$;

-- 1c) ActualLoadingStatus: replay has (NOT_STARTED,IN_PROGRESS,COMPLETED,CANCELLED);
--     schema wants (DRAFT,IN_PROGRESS,PARTIALLY_LOADED,COMPLETED,FINALIZED,CANCELLED).
--     Rebuild only when the label set actually differs (no-op on live).
DO $$
DECLARE
  want text[] := ARRAY['DRAFT','IN_PROGRESS','PARTIALLY_LOADED','COMPLETED','FINALIZED','CANCELLED'];
  have text[];
BEGIN
  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) INTO have
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
   WHERE t.typname = 'ActualLoadingStatus';
  IF have IS DISTINCT FROM want THEN
    EXECUTE 'ALTER TABLE "ActualLoading" ALTER COLUMN "status" DROP DEFAULT';
    EXECUTE $q$CREATE TYPE "ActualLoadingStatus_new" AS ENUM ('DRAFT','IN_PROGRESS','PARTIALLY_LOADED','COMPLETED','FINALIZED','CANCELLED')$q$;
    EXECUTE 'ALTER TABLE "ActualLoading" ALTER COLUMN "status" TYPE "ActualLoadingStatus_new" USING ("status"::text::"ActualLoadingStatus_new")';
    EXECUTE 'ALTER TYPE "ActualLoadingStatus" RENAME TO "ActualLoadingStatus_old"';
    EXECUTE 'ALTER TYPE "ActualLoadingStatus_new" RENAME TO "ActualLoadingStatus"';
    EXECUTE 'DROP TYPE "ActualLoadingStatus_old"';
    EXECUTE 'ALTER TABLE "ActualLoading" ALTER COLUMN "status" SET DEFAULT ''DRAFT''';
  END IF;
END $$;

-- 1d) CargoStatus: replay has READY, schema wants READY_FOR_LOADING.
DO $$
DECLARE
  want text[] := ARRAY['REGISTERED','AT_YARD','READY_FOR_LOADING','LOADED','DELIVERED','CANCELLED'];
  have text[];
BEGIN
  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) INTO have
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
   WHERE t.typname = 'CargoStatus';
  IF have IS DISTINCT FROM want THEN
    EXECUTE 'ALTER TABLE "Cargo" ALTER COLUMN "status" DROP DEFAULT';
    EXECUTE $q$CREATE TYPE "CargoStatus_new" AS ENUM ('REGISTERED','AT_YARD','READY_FOR_LOADING','LOADED','DELIVERED','CANCELLED')$q$;
    EXECUTE 'ALTER TABLE "Cargo" ALTER COLUMN "status" TYPE "CargoStatus_new" USING ("status"::text::"CargoStatus_new")';
    EXECUTE 'ALTER TYPE "CargoStatus" RENAME TO "CargoStatus_old"';
    EXECUTE 'ALTER TYPE "CargoStatus_new" RENAME TO "CargoStatus"';
    EXECUTE 'DROP TYPE "CargoStatus_old"';
    EXECUTE 'ALTER TABLE "Cargo" ALTER COLUMN "status" SET DEFAULT ''REGISTERED''';
  END IF;
END $$;

-- 1e) InspectionStatus: replay has (PENDING,APPROVED,REJECTED),
--     schema wants (PENDING,BOOKED,DONE,FAILED,NEEDS_REINSPECTION).
--     Two columns depend on it: Cargo.inspectionStatus and Inspection.status.
DO $$
DECLARE
  want text[] := ARRAY['PENDING','BOOKED','DONE','FAILED','NEEDS_REINSPECTION'];
  have text[];
BEGIN
  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) INTO have
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
   WHERE t.typname = 'InspectionStatus';
  IF have IS DISTINCT FROM want THEN
    -- Dependent expression: the partial unique index
    -- Inspection_one_pending_per_cargo_idx has predicate
    -- `status = 'PENDING'::"InspectionStatus"`. Postgres must rewrite that
    -- predicate during the type swap and cannot compare the old enum to the
    -- new one, so drop it first and rebuild it afterwards (42883 otherwise).
    EXECUTE 'DROP INDEX IF EXISTS "Inspection_one_pending_per_cargo_idx"';
    EXECUTE 'ALTER TABLE "Cargo" ALTER COLUMN "inspectionStatus" DROP DEFAULT';
    EXECUTE 'ALTER TABLE "Inspection" ALTER COLUMN "status" DROP DEFAULT';
    EXECUTE $q$CREATE TYPE "InspectionStatus_new" AS ENUM ('PENDING','BOOKED','DONE','FAILED','NEEDS_REINSPECTION')$q$;
    EXECUTE 'ALTER TABLE "Cargo" ALTER COLUMN "inspectionStatus" TYPE "InspectionStatus_new" USING ("inspectionStatus"::text::"InspectionStatus_new")';
    EXECUTE 'ALTER TABLE "Inspection" ALTER COLUMN "status" TYPE "InspectionStatus_new" USING ("status"::text::"InspectionStatus_new")';
    EXECUTE 'ALTER TYPE "InspectionStatus" RENAME TO "InspectionStatus_old"';
    EXECUTE 'ALTER TYPE "InspectionStatus_new" RENAME TO "InspectionStatus"';
    EXECUTE 'DROP TYPE "InspectionStatus_old"';
    EXECUTE 'ALTER TABLE "Cargo" ALTER COLUMN "inspectionStatus" SET DEFAULT ''PENDING''';
    EXECUTE 'ALTER TABLE "Inspection" ALTER COLUMN "status" SET DEFAULT ''PENDING''';
    EXECUTE $q$CREATE UNIQUE INDEX "Inspection_one_pending_per_cargo_idx" ON "Inspection"("cargoId") WHERE (status = 'PENDING'::"InspectionStatus")$q$;
  END IF;
END $$;

-- =========================================================================
-- 2) Columns present in schema.prisma but created by no migration
-- =========================================================================
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "cargoValue" DECIMAL(18,2);
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "cargoValueCurrency" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "chassis" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "comment" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "jobId" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "pod" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "pol" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "serial" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "units" INTEGER;

ALTER TABLE "LoadListItem"
  ADD COLUMN IF NOT EXISTS "selectionStatus" "LoadListItemSelectionStatus" NOT NULL DEFAULT 'NOT_SELECTED';

-- ActualLoading.status default (schema: @default(DRAFT); safe/idempotent)
ALTER TABLE "ActualLoading" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- =========================================================================
-- 3) Tables declared by schema.prisma but created by no migration
--    (DDL copied verbatim from `prisma migrate diff --from-migrations`)
-- =========================================================================
CREATE TABLE IF NOT EXISTS "agent_destinations" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "portId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "agent_destinations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NumberingSequence" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeValue" TEXT,
    "prefix" TEXT NOT NULL DEFAULT '',
    "padding" INTEGER NOT NULL DEFAULT 5,
    "format" TEXT NOT NULL DEFAULT '{prefix}{sequence}',
    "nextSequence" INTEGER NOT NULL DEFAULT 1,
    "period" TEXT NOT NULL DEFAULT 'YYYY',
    "companyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NumberingSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FileAttachment" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "storageAdapter" TEXT NOT NULL DEFAULT 'local',
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" BIGINT NOT NULL DEFAULT 0,
    "contentType" TEXT,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "format" TEXT NOT NULL DEFAULT 'PDF',
    "storageAdapter" TEXT NOT NULL DEFAULT 'local',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currentVersionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DocumentTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "storageKey" TEXT NOT NULL,
    "storageAdapter" TEXT NOT NULL DEFAULT 'local',
    "mimeType" TEXT NOT NULL,
    "size" BIGINT NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- =========================================================================
-- 4) Indexes for those tables
-- =========================================================================
CREATE INDEX IF NOT EXISTS "agent_destinations_agentId_idx" ON "agent_destinations"("agentId");
CREATE INDEX IF NOT EXISTS "agent_destinations_portId_idx" ON "agent_destinations"("portId");
CREATE INDEX IF NOT EXISTS "agent_destinations_isActive_idx" ON "agent_destinations"("isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_destinations_agentId_portId_key" ON "agent_destinations"("agentId", "portId");

CREATE UNIQUE INDEX IF NOT EXISTS "NumberingSequence_name_key" ON "NumberingSequence"("name");
CREATE INDEX IF NOT EXISTS "NumberingSequence_documentType_scopeType_scopeValue_isActiv_idx" ON "NumberingSequence"("documentType", "scopeType", "scopeValue", "isActive");
CREATE INDEX IF NOT EXISTS "NumberingSequence_isActive_idx" ON "NumberingSequence"("isActive");

CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_timestamp_idx" ON "AuditLog"("entityType", "entityId", "timestamp");

CREATE INDEX IF NOT EXISTS "FileAttachment_entityType_entityId_idx" ON "FileAttachment"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "FileAttachment_category_idx" ON "FileAttachment"("category");
CREATE INDEX IF NOT EXISTS "FileAttachment_uploadedById_idx" ON "FileAttachment"("uploadedById");
CREATE INDEX IF NOT EXISTS "FileAttachment_storageAdapter_storageKey_idx" ON "FileAttachment"("storageAdapter", "storageKey");
CREATE INDEX IF NOT EXISTS "FileAttachment_deletedAt_idx" ON "FileAttachment"("deletedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentTemplate_name_key" ON "DocumentTemplate"("name");
CREATE INDEX IF NOT EXISTS "DocumentTemplate_documentType_idx" ON "DocumentTemplate"("documentType");
CREATE INDEX IF NOT EXISTS "DocumentTemplate_documentType_isActive_idx" ON "DocumentTemplate"("documentType", "isActive");

CREATE INDEX IF NOT EXISTS "DocumentTemplateVersion_templateId_idx" ON "DocumentTemplateVersion"("templateId");
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentTemplateVersion_templateId_version_key" ON "DocumentTemplateVersion"("templateId", "version");

-- =========================================================================
-- 5) Foreign keys
-- =========================================================================

-- agent_destinations: live carries the legacy name AgentDestination_*_fkey and
-- omits ON UPDATE CASCADE; drop the legacy one, ensure the canonical one.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgentDestination_agentId_fkey') THEN
    EXECUTE 'ALTER TABLE "agent_destinations" DROP CONSTRAINT "AgentDestination_agentId_fkey"';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_destinations_agentId_fkey') THEN
    EXECUTE 'ALTER TABLE "agent_destinations" ADD CONSTRAINT "agent_destinations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgentDestination_portId_fkey') THEN
    EXECUTE 'ALTER TABLE "agent_destinations" DROP CONSTRAINT "AgentDestination_portId_fkey"';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_destinations_portId_fkey') THEN
    EXECUTE 'ALTER TABLE "agent_destinations" ADD CONSTRAINT "agent_destinations_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("id") ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

-- DocumentTemplateVersion -> DocumentTemplate
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentTemplateVersion_templateId_fkey') THEN
    EXECUTE 'ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

-- Cargo party FKs: schema wants ON UPDATE CASCADE; the cutover migration copied
-- the pre-existing live definition (ON DELETE SET NULL only). Repair in place,
-- and only when the definition is actually wrong.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Cargo_shipperId_fkey') THEN
    EXECUTE 'ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "shippers"("id") ON DELETE SET NULL ON UPDATE CASCADE';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'Cargo_shipperId_fkey' AND pg_get_constraintdef(oid) LIKE '%ON UPDATE CASCADE%'
  ) THEN
    EXECUTE 'ALTER TABLE "Cargo" DROP CONSTRAINT "Cargo_shipperId_fkey"';
    EXECUTE 'ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "shippers"("id") ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Cargo_consigneeId_fkey') THEN
    EXECUTE 'ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_consigneeId_fkey" FOREIGN KEY ("consigneeId") REFERENCES "consignees"("id") ON DELETE SET NULL ON UPDATE CASCADE';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'Cargo_consigneeId_fkey' AND pg_get_constraintdef(oid) LIKE '%ON UPDATE CASCADE%'
  ) THEN
    EXECUTE 'ALTER TABLE "Cargo" DROP CONSTRAINT "Cargo_consigneeId_fkey"';
    EXECUTE 'ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_consigneeId_fkey" FOREIGN KEY ("consigneeId") REFERENCES "consignees"("id") ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;

-- =========================================================================
-- 6) Constraint/index naming: Prisma derives names from the MAPPED table name
--    (agents_pkey, shippers_code_idx), but the party-masters/agent-linkage
--    migrations wrote model-name-based names captured from live. Rename only
--    when the legacy name exists and the canonical one does not.
-- =========================================================================
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('agents',    'Agent_pkey',      'agents_pkey'),
      ('consignees','Consignee_pkey',  'consignees_pkey'),
      ('shippers',  'Shipper_pkey',    'shippers_pkey'),
      ('agent_destinations','AgentDestination_pkey','agent_destinations_pkey')
    ) AS t(tbl, old_name, new_name)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('"' || rec.tbl || '"') AND conname = rec.old_name)
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('"' || rec.tbl || '"') AND conname = rec.new_name) THEN
      EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', rec.tbl, rec.old_name, rec.new_name);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('agents',     'Agent_code_idx',        'agents_code_idx'),
      ('agents',     'Agent_code_key',        'agents_code_key'),
      ('agents',     'Agent_isActive_idx',    'agents_isActive_idx'),
      ('agents',     'Agent_name_idx',        'agents_name_idx'),
      ('consignees', 'Consignee_code_idx',    'consignees_code_idx'),
      ('consignees', 'Consignee_code_key',    'consignees_code_key'),
      ('consignees', 'Consignee_isActive_idx','consignees_isActive_idx'),
      ('consignees', 'Consignee_name_idx',    'consignees_name_idx'),
      ('shippers',   'Shipper_code_idx',      'shippers_code_idx'),
      ('shippers',   'Shipper_code_key',      'shippers_code_key'),
      ('shippers',   'Shipper_isActive_idx',  'shippers_isActive_idx'),
      ('shippers',   'Shipper_name_idx',      'shippers_name_idx'),
      ('agent_destinations','AgentDestination_agentId_idx',        'agent_destinations_agentId_idx'),
      ('agent_destinations','AgentDestination_portId_idx',         'agent_destinations_portId_idx'),
      ('agent_destinations','AgentDestination_isActive_idx',       'agent_destinations_isActive_idx'),
      ('agent_destinations','AgentDestination_agentId_portId_key', 'agent_destinations_agentId_portId_key')
    ) AS t(tbl, old_name, new_name)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = rec.old_name AND n.nspname = current_schema())
       AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = rec.new_name AND n.nspname = current_schema()) THEN
      EXECUTE format('ALTER INDEX %I RENAME TO %I', rec.old_name, rec.new_name);
    END IF;
  END LOOP;
END $$;

-- ==========================================================================
-- source: 20261003120000_bl_decoupling_additive
-- ==========================================================================
-- Phase 4 unit 2 (P4-U2) — B/L decoupling, ADDITIVE ONLY (ADR-045 decision 1).
-- Generated with `prisma migrate diff --from-migrations --to-schema-datamodel --script`
-- against a scratch shadow DB, then extended with the idempotent data backfills.
-- No columns are dropped; the FK drop/re-add pairs are Postgres' only way to change
-- nullability (they become ON DELETE SET NULL, matching the new optional legacy linkage).

-- DropForeignKey (required to relax nullability + switch to SET NULL)
ALTER TABLE "bills_of_lading" DROP CONSTRAINT "bills_of_lading_manifestId_fkey";

-- DropForeignKey
ALTER TABLE "bills_of_lading_items" DROP CONSTRAINT "bills_of_lading_items_manifestItemId_fkey";

-- AlterTable
ALTER TABLE "bills_of_lading" ADD COLUMN IF NOT EXISTS "destinationPortId" TEXT,
ALTER COLUMN "manifestId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "bills_of_lading_items" ALTER COLUMN "manifestItemId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bills_of_lading_destinationPortId_idx" ON "bills_of_lading"("destinationPortId");

-- AddForeignKey
ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "manifests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading_items" ADD CONSTRAINT "bills_of_lading_items_manifestItemId_fkey" FOREIGN KEY ("manifestItemId") REFERENCES "manifest_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data backfills (idempotent UPDATEs; no schema)
-- 1) Existing B/L items' cargoId from their manifest line (ManifestItem.cargoId is
--    REQUIRED, so this is a clean per-row copy; no-op where already populated).
UPDATE "bills_of_lading_items" bli
SET "cargoId" = mi."cargoId"
FROM "manifest_items" mi
WHERE bli."manifestItemId" = mi.id
  AND bli."cargoId" IS NULL;

-- 2) Existing bills' destinationPortId (the P4-U3 numbering scope key) from their voyage.
UPDATE "bills_of_lading" bl
SET "destinationPortId" = v."destinationPortId"
FROM "Voyage" v
WHERE bl."voyageId" = v.id
  AND bl."destinationPortId" IS NULL;

