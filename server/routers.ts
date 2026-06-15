import { COOKIE_NAME } from "@shared/const";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  DEFAULT_IQ_QUESTIONS,
  DEFAULT_OQ_QUESTIONS,
  DEFAULT_IQ_QUESTIONS_AUTO_REFRIGERATOR,
  DEFAULT_OQ_QUESTIONS_AUTO_REFRIGERATOR,
  DEFAULT_IQ_QUESTIONS_WAREHOUSE,
  DEFAULT_OQ_QUESTIONS_WAREHOUSE,
  STAGE_TEMPLATES,
  WAREHOUSE_STAGE_TEMPLATES,
  TEMP_MODES,
  DEFAULT_SENSOR_ACCURACY_C,
  applySensorAccuracyGuardBand,
} from "@shared/validation";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { verifyPasswordHash } from "./_core/passwords";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  approveCompanyMember,
  createCompany,
  getCompany,
  getCompanyMember,
  getUserCompanies,
  getUserPendingMemberships,
  inviteUserToCompany,
  listAllProtocolsForAdmin,
  listCompanies,
  listCompanyMembers,
  listProtocolsByCompany,
  rejectCompanyMember,
  removeCompanyMember,
  deleteLogger,
  deleteOrganization,
  deleteProtocolCascade,
  getGeneralInfo,
  getOrganization,
  getProtocol,
  getPVSession,
  cloneProtocol,
  insertLogger,
  insertOrganization,
  insertProtocol,
  listChecklist,
  listLoggers,
  listOrganizations,
  listOrganizationsByCompany,
  listAllProtocols,
  listAllProtocolsByCompany,
  listProtocolsForOrg,
  getOrganizationByCompany,
  getProtocolByCompany,
  nextProtocolNumber,
  listSensors,
  getSensor,
  createSensor,
  updateSensor,
  deleteSensor,
  getSensorsExpiringIn30Days,
  bulkCreateSensors,
  addSensorToProtocol,
  getProtocolSensors,
  removeProtocolSensor,
  clearProtocolSensors,
  saveChecklist,
  updateLogger,
  updateOrganization,
  updatePVSession,
  updateProtocolStatus,
  upsertGeneralInfo,
  listAllQuestionTemplates,
  listQuestionTemplates,
  insertQuestionTemplate,
  updateQuestionTemplate,
  deleteQuestionTemplate,
  getExcursionSession,
  upsertExcursionSession,
  listExcursionLoggers,
  insertExcursionLogger,
  updateExcursionLogger,
  deleteExcursionLogger,
  deleteAllExcursionLoggers,
  getWarehouseSections,
  saveWarehouseSections,
  listWarehouseEquipment,
  createWarehouseEquipment,
  updateWarehouseEquipment,
  deleteWarehouseEquipment,
  getUserByEmail,
  upsertUser,
} from "./db";
import {
  calcTest1,
  calcTest2,
  calcTest3,
} from "./excursionCalc";
import {
  clipSeries,
  computeStats,
  detectExternalSensors,
  findDeviations,
  parseLoggerBuffer,
  resampleSeries,
} from "./loggerParser";
import { generateProtocolPdf, type ReportInput } from "./pdfReport";
import { storagePut, storageReadBuffer } from "./storage";
import { buildWarehouseQuestions } from "./warehouseQuestions";

const TEMP_MODE_SCHEMA = z.enum(["2-8", "8-15", "15-25"]);
const PORTAL_ADMIN_OPEN_ID = "local-dev-admin";
const PORTAL_ADMIN_NAME = "Local Dev Admin";
const PORTAL_ADMIN_EMAIL = "dev@local.test";
const PORTAL_ADMIN_APP_ID = "portal-admin";
const PASSWORD_LOGIN_MAX_ATTEMPTS = 8;
const PASSWORD_LOGIN_WINDOW_MS = 10 * 60 * 1000;
const passwordLoginAttempts = new Map<string, { count: number; resetAt: number }>();

function sha256(value: string) {
  return createHash("sha256").update(value).digest();
}

function secureStringEquals(a: string, b: string) {
  const left = sha256(a);
  const right = sha256(b);
  return timingSafeEqual(left, right);
}

function passwordLoginKey(req: unknown) {
  const request = req as { ip?: string; headers?: Record<string, unknown> };
  const forwarded = request.headers?.["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(firstForwarded || request.ip || "unknown").split(",")[0].trim();
}

function assertPasswordLoginAllowed(key: string) {
  const now = Date.now();
  const attempts = passwordLoginAttempts.get(key);
  if (!attempts || attempts.resetAt <= now) {
    passwordLoginAttempts.set(key, { count: 0, resetAt: now + PASSWORD_LOGIN_WINDOW_MS });
    return;
  }
  if (attempts.count >= PASSWORD_LOGIN_MAX_ATTEMPTS) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Слишком много попыток входа. Повторите позже.",
    });
  }
}

function recordPasswordLoginFailure(key: string) {
  const now = Date.now();
  const attempts = passwordLoginAttempts.get(key);
  if (!attempts || attempts.resetAt <= now) {
    passwordLoginAttempts.set(key, { count: 1, resetAt: now + PASSWORD_LOGIN_WINDOW_MS });
    return;
  }
  attempts.count += 1;
}

function clearPasswordLoginFailures(key: string) {
  passwordLoginAttempts.delete(key);
}

function setSessionCookie(ctx: { req: unknown; res: unknown }, token: string) {
  const cookieOptions = getSessionCookieOptions(ctx.req);
  (ctx.res as any).cookie(COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: 365 * 24 * 60 * 60 * 1000,
  });
}

function rangeFor(tempMode: string, customMin?: number | null, customMax?: number | null) {
  const mode = TEMP_MODES.find(m => m.id === tempMode);
  const rawMin = customMin ?? mode?.min ?? 2;
  const rawMax = customMax ?? mode?.max ?? 8;
  return applySensorAccuracyGuardBand(rawMin, rawMax, DEFAULT_SENSOR_ACCURACY_C);
}

function defaultQuestionsFor(stage: "iq" | "oq", equipmentType?: string | null): string[] {
  if (equipmentType === "warehouse") {
    return stage === "iq" ? DEFAULT_IQ_QUESTIONS_WAREHOUSE : DEFAULT_OQ_QUESTIONS_WAREHOUSE;
  }
  if (equipmentType === "auto-refrigerator") {
    return stage === "iq"
      ? DEFAULT_IQ_QUESTIONS_AUTO_REFRIGERATOR
      : DEFAULT_OQ_QUESTIONS_AUTO_REFRIGERATOR;
  }
  return stage === "iq" ? DEFAULT_IQ_QUESTIONS : DEFAULT_OQ_QUESTIONS;
}

function normalizeReportActorName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (trimmed === "Сафиуллин А.") return "Сафиуллин А.В.";
  return trimmed;
}

function nonBlankString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function pickReportActorFromGeneralInfo(gi: any): string | null {
  const groups = [gi?.signatoriesPart2, gi?.signatoriesPart1, gi?.commissionMembers];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    const preferred =
      group.find((person: any) => /валидац|подготов|состав/i.test(String(person?.role ?? ""))) ??
      group.find((person: any) => normalizeReportActorName(person?.name));
    const name = normalizeReportActorName(preferred?.name);
    if (name) return name;
  }
  return null;
}

async function ownProtocol(userId: number, protocolId: number) {
  // Try by userId first; if not found, try by companyId (shared company access)
  let p = await getProtocol(userId, protocolId);
  if (!p) {
    const userCompanies = await getUserCompanies(userId);
    if (userCompanies.length > 0) {
      p = await getProtocolByCompany(userCompanies[0].id, protocolId);
    }
    // Also try admin's company
    if (!p) {
      const adminCompanies = await listCompanies(userId);
      if (adminCompanies.length > 0) {
        p = await getProtocolByCompany(adminCompanies[0].id, protocolId);
      }
    }
  }
  if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Протокол не найден" });
  return p;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    passwordLogin: publicProcedure
      .input(z.object({
        email: z.string().max(320).optional().nullable(),
        password: z.string().min(1).max(256),
      }))
      .mutation(async ({ ctx, input }) => {
        const key = passwordLoginKey(ctx.req);
        assertPasswordLoginAllowed(key);
        const email = input.email?.trim().toLowerCase();

        if (email) {
          const parsedEmail = z.string().email().safeParse(email);
          if (!parsedEmail.success) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Укажите корректный email." });
          }

          const user = await getUserByEmail(email);
          if (!user || !verifyPasswordHash(input.password, user.passwordHash)) {
            recordPasswordLoginFailure(key);
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Неверный email или пароль." });
          }

          await upsertUser({
            openId: user.openId,
            loginMethod: "password",
            lastSignedIn: new Date().toISOString(),
          });

          const sessionToken = await sdk.signSession({
            openId: user.openId,
            appId: ENV.appId || PORTAL_ADMIN_APP_ID,
            name: user.name || user.email || "Portal User",
          });

          setSessionCookie(ctx, sessionToken);
          clearPasswordLoginFailures(key);
          return { success: true } as const;
        }

        if (!ENV.portalAdminPassword) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Парольный вход не настроен.",
          });
        }

        if (!secureStringEquals(input.password, ENV.portalAdminPassword)) {
          recordPasswordLoginFailure(key);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Неверный пароль." });
        }

        await upsertUser({
          openId: PORTAL_ADMIN_OPEN_ID,
          name: PORTAL_ADMIN_NAME,
          email: PORTAL_ADMIN_EMAIL,
          loginMethod: "portal-password",
          role: "admin",
          lastSignedIn: new Date().toISOString(),
        });

        const sessionToken = await sdk.signSession({
          openId: PORTAL_ADMIN_OPEN_ID,
          appId: ENV.appId || PORTAL_ADMIN_APP_ID,
          name: PORTAL_ADMIN_NAME,
        });

        setSessionCookie(ctx, sessionToken);
        clearPasswordLoginFailures(key);
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      (ctx.res as any).clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  /* -------------------------------------------------------------- */
  /* Organizations                                                  */
  /* -------------------------------------------------------------- */
  organizations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      // Both admins and regular users see shared company client base
      // Admin: find companies they created and show all orgs in those companies
      if (ctx.user.role === "admin") {
        const adminCompanies = await listCompanies(ctx.user.id);
        if (adminCompanies.length > 0) {
          return listOrganizationsByCompany(adminCompanies[0].id);
        }
        // Fallback: admin has no company yet, show their own orgs
        return listOrganizations(ctx.user.id);
      }
      // Regular user: show all orgs in their approved company
      const userCompanies = await getUserCompanies(ctx.user.id);
      if (userCompanies.length > 0) {
        return listOrganizationsByCompany(userCompanies[0].id);
      }
      return listOrganizations(ctx.user.id);
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      let org = await getOrganization(ctx.user.id, input.id);
      if (!org) {
        const userCompanies = await getUserCompanies(ctx.user.id);
        if (userCompanies.length > 0) org = await getOrganizationByCompany(userCompanies[0].id, input.id);
        if (!org) {
          const adminCompanies = await listCompanies(ctx.user.id);
          if (adminCompanies.length > 0) org = await getOrganizationByCompany(adminCompanies[0].id, input.id);
        }
      }
      return org;
    }),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          bin: z.string().optional().nullable(),
          addressLegal: z.string().optional().nullable(),
          addressFact: z.string().optional().nullable(),
          responsible: z.string().optional().nullable(),
          phone: z.string().optional().nullable(),
          email: z.string().optional().nullable(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        // Admins can always create; regular users must belong to an approved company
        if (ctx.user.role !== "admin") {
          const userCompanies = await getUserCompanies(ctx.user.id);
          if (userCompanies.length === 0) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Ваша учётная запись ожидает одобрения администратора. Создание организаций недоступно.",
            });
          }
          const companyId = userCompanies[0].id;
          return insertOrganization({ ...input, userId: ctx.user.id, companyId });
        }
        // Admin: attach to their first company if they have one
        const adminCompanies = await listCompanies(ctx.user.id);
        const companyId = adminCompanies.length > 0 ? adminCompanies[0].id : undefined;
        return insertOrganization({ ...input, userId: ctx.user.id, companyId });
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1),
          bin: z.string().optional().nullable(),
          addressLegal: z.string().optional().nullable(),
          addressFact: z.string().optional().nullable(),
          responsible: z.string().optional().nullable(),
          phone: z.string().optional().nullable(),
          email: z.string().optional().nullable(),
        }),
      )
      .mutation(({ ctx, input }) => updateOrganization(ctx.user.id, input.id, input)),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteOrganization(ctx.user.id, input.id);
        return { success: true };
      }),
    uploadLogo: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          fileName: z.string(),
          contentType: z.string(),
          base64: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        let org = await getOrganization(ctx.user.id, input.id);
        if (!org) {
          const userCompanies = await getUserCompanies(ctx.user.id);
          if (userCompanies.length > 0) org = await getOrganizationByCompany(userCompanies[0].id, input.id);
          if (!org) {
            const adminCompanies = await listCompanies(ctx.user.id);
            if (adminCompanies.length > 0) org = await getOrganizationByCompany(adminCompanies[0].id, input.id);
          }
        }
        if (!org) throw new TRPCError({ code: "NOT_FOUND" });
        const buf = Buffer.from(input.base64, "base64");
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const { key, url } = await storagePut(
          `org-${input.id}/logo-${safeName}`,
          buf,
          input.contentType,
        );
        return updateOrganization(ctx.user.id, input.id, { logoKey: key, logoUrl: url });
      }),
  }),

  /* -------------------------------------------------------------- */
  /* Protocols                                                      */
  /* -------------------------------------------------------------- */
  protocols: router({
    listForOrg: protectedProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(({ ctx, input }) => listProtocolsForOrg(ctx.user.id, input.organizationId)),
    listAll: protectedProcedure.query(async ({ ctx }) => {
      // Admin: show all protocols in their company
      if (ctx.user.role === "admin") {
        const adminCompanies = await listCompanies(ctx.user.id);
        if (adminCompanies.length > 0) return listAllProtocolsByCompany(adminCompanies[0].id);
        return listAllProtocols(ctx.user.id);
      }
      // Regular user: show all protocols in their approved company
      const userCompanies = await getUserCompanies(ctx.user.id);
      if (userCompanies.length > 0) return listAllProtocolsByCompany(userCompanies[0].id);
      return listAllProtocols(ctx.user.id);
    }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ ctx, input }) => ownProtocol(ctx.user.id, input.id)),
    create: protectedProcedure
      .input(z.object({ organizationId: z.number(), companyId: z.number().optional(), equipmentType: z.enum(["refrigerator", "auto-refrigerator", "warehouse", "other"]).optional(), customEquipmentName: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        // Admins can always create; regular users must belong to an approved company
        if (ctx.user.role !== "admin") {
          const userCompanies = await getUserCompanies(ctx.user.id);
          if (userCompanies.length === 0) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Ваша учётная запись ожидает одобрения администратора. Создание протоколов недоступно.",
            });
          }
        }
        // Look up org by userId first, then by companyId (shared company access)
        let org = await getOrganization(ctx.user.id, input.organizationId);
        if (!org) {
          // Try company-based access
          const userCompanies = await getUserCompanies(ctx.user.id);
          if (userCompanies.length > 0) {
            org = await getOrganizationByCompany(userCompanies[0].id, input.organizationId);
          }
          if (!org) {
            const adminCompanies = await listCompanies(ctx.user.id);
            if (adminCompanies.length > 0) {
              org = await getOrganizationByCompany(adminCompanies[0].id, input.organizationId);
            }
          }
        }
        if (!org) throw new TRPCError({ code: "NOT_FOUND" });
        const year = new Date().getFullYear();
        const number = await nextProtocolNumber(input.organizationId, year);
        // Use org.companyId if not provided (org already linked to company)
        const companyId = input.companyId ?? org.companyId ?? 0;
        return insertProtocol({
          organizationId: input.organizationId,
          companyId,
          userId: ctx.user.id,
          number,
          equipmentType: input.equipmentType ?? "refrigerator",
          customEquipmentName: input.customEquipmentName ?? null,
        });
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Verify access (company-aware) before deleting
        const p = await ownProtocol(ctx.user.id, input.id);
        await deleteProtocolCascade(p.userId, input.id);
        return { success: true };
      }),
    clone: protectedProcedure
      .input(z.object({ sourceProtocolId: z.number(), organizationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Verify user owns the source protocol
        await ownProtocol(ctx.user.id, input.sourceProtocolId);
        // Clone the protocol (equipment, org, commission preserved; sensors/results reset)
        const newProto = await cloneProtocol(ctx.user.id, input.sourceProtocolId, input.organizationId);
        return newProto;
      }),
  }),

  /* -------------------------------------------------------------- */
  /* General info                                                   */
  /* -------------------------------------------------------------- */
  generalInfo: router({
    get: protectedProcedure
      .input(z.object({ protocolId: z.number() }))
      .query(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        return getGeneralInfo(input.protocolId);
      }),
    save: protectedProcedure
      .input(
        z.object({
          protocolId: z.number(),
          equipmentType: z.string().optional().nullable(),
          manufacturer: z.string().optional().nullable(),
          model: z.string().optional().nullable(),
          serial: z.string().optional().nullable(),
          inventory: z.string().optional().nullable(),
          year: z.number().int().optional().nullable(),
          tempMode: z.string().optional().nullable(),
          location: z.string().optional().nullable(),
          purpose: z.string().optional().nullable(),
          validationDate: z.string().optional().nullable(),
          basis: z.string().optional().nullable(),
          qualificationType: z.string().optional().nullable(),
          season: z.string().optional().nullable(),
          commissionMembers: z
            .array(z.object({ name: z.string(), role: z.string(), company: z.string().optional().nullable() }))
            .optional()
            .nullable(),
          signatoriesPart1: z
            .array(z.object({ name: z.string(), role: z.string(), company: z.string().optional().nullable() }))
            .optional()
            .nullable(),
          signatoriesPart2: z
            .array(z.object({ name: z.string(), role: z.string(), company: z.string().optional().nullable() }))
            .optional()
            .nullable(),
          planDeviations: z.string().optional().nullable(),
          recommendations: z.string().optional().nullable(),
          reportDate: z.string().optional().nullable(),
          documentValidityPeriod: z.string().optional().nullable(),
          // ── Warehouse / storage zone (EAEU Рек. №8) ──
          whLengthM: z.union([z.number(), z.string()]).optional().nullable(),
          whWidthM: z.union([z.number(), z.string()]).optional().nullable(),
          whHeightM: z.union([z.number(), z.string()]).optional().nullable(),
          whHumidityControl: z.number().int().optional().nullable(),
          whHumidityMin: z.union([z.number(), z.string()]).optional().nullable(),
          whHumidityMax: z.union([z.number(), z.string()]).optional().nullable(),
          whSeason: z.string().optional().nullable(),
          whStudyType: z.string().optional().nullable(),
          whExternalEnv: z.number().int().optional().nullable(),
          whLayoutNotes: z.string().optional().nullable(),
          fillStatus: z.enum(["empty", "loaded"]).optional().nullable(),
          loadPercent: z.union([z.number(), z.string()]).optional().nullable(),
        }),
      )
       .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        // Validate: validationDate must not be later than the earliest sensor recording start
        if (input.validationDate) {
          const loggers = await listLoggers(input.protocolId);
          const earliestSensorTs = loggers.reduce<number | null>((min, l) => {
            const ts = (l as any).firstTs as number | null;
            if (!ts) return min;
            return min === null ? ts : Math.min(min, ts);
          }, null);
          if (earliestSensorTs !== null) {
            // validationDate is YYYY-MM-DD, treat as start of that day (00:00 local)
            const validationMs = new Date(input.validationDate + "T00:00:00").getTime();
            if (validationMs > earliestSensorTs) {
              const earliestDate = new Date(earliestSensorTs).toLocaleDateString("ru-RU", {
                day: "2-digit", month: "2-digit", year: "numeric",
              });
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Дата валидации не может быть позже даты начала записи датчиков (${earliestDate}). Пожалуйста, укажите дату не позднее ${earliestDate}.`,
              });
            }
          }
        }
        const { protocolId, ...patch } = input;
        // Drizzle decimal columns expect strings (or null). Coerce numeric inputs.
        const decimalKeys = [
          "whLengthM",
          "whWidthM",
          "whHeightM",
          "whHumidityMin",
          "whHumidityMax",
          "loadPercent",
        ] as const;
        const coerced: any = { ...patch };
        for (const k of decimalKeys) {
          if (!(k in coerced)) continue;
          const v = coerced[k];
          if (v === undefined || v === null || v === "") {
            coerced[k] = null;
          } else {
            coerced[k] = String(v);
          }
        }
        if ("loadPercent" in coerced && coerced.loadPercent !== null) {
          const loadPercent = Number(coerced.loadPercent);
          if (!Number.isFinite(loadPercent) || loadPercent < 0 || loadPercent > 100) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Процент загруженности объекта должен быть от 0 до 100.",
            });
          }
        }
        return upsertGeneralInfo(protocolId, coerced);
      }),
  }),
  /* -------------------------------------------------------------- */
  /* Stage templates                                                */
  /* -------------------------------------------------------------- */
  templates: router({
    questions: publicProcedure
      .input(z.object({ stage: z.enum(["iq", "oq"]), equipmentType: z.string().optional() }))
      .query(async ({ input }) => {
        // Try to get DB templates for this equipment type first
        if (input.equipmentType) {
          const dbTemplates = await listQuestionTemplates(input.stage, input.equipmentType);
          if (dbTemplates.length > 0) {
            return dbTemplates.map(t => t.text);
          }
          if (input.equipmentType === "warehouse" || input.equipmentType === "auto-refrigerator") {
            return defaultQuestionsFor(input.stage, input.equipmentType);
          }
          // If no equipment-specific templates, fall back to generic DB templates
          const genericTemplates = await listQuestionTemplates(input.stage);
          if (genericTemplates.length > 0) {
            return genericTemplates.map(t => t.text);
          }
        } else {
          const dbTemplates = await listQuestionTemplates(input.stage);
          if (dbTemplates.length > 0) {
            return dbTemplates.map(t => t.text);
          }
        }
        // Fall back to static defaults
        return defaultQuestionsFor(input.stage, input.equipmentType);
      }),
    stageBlocks: publicProcedure
      .input(z.object({ stage: z.enum(["iq", "oq", "pv"]) }))
      .query(({ input }) => STAGE_TEMPLATES[input.stage]),
  }),

  /* -------------------------------------------------------------- */
  /* IQ / OQ checklist                                              */
  /* -------------------------------------------------------------- */
  checklist: router({
    get: protectedProcedure
      .input(z.object({
        protocolId: z.number(),
        stage: z.enum(["iq", "oq"]),
        /** For warehouse protocols: which equipment's checklist to load */
        warehouseEquipmentId: z.number().nullable().optional(),
      }))
      .query(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        return listChecklist(input.protocolId, input.stage, input.warehouseEquipmentId);
      }),
    save: protectedProcedure
      .input(
        z.object({
          protocolId: z.number(),
          stage: z.enum(["iq", "oq"]),
          /** For warehouse protocols: which equipment's checklist to save */
          warehouseEquipmentId: z.number().nullable().optional(),
          items: z.array(
            z.object({
              questionIndex: z.number(),
              questionText: z.string(),
              answer: z.enum(["yes", "no", "na", "unset"]),
              comment: z.string().nullable(),
            }),
          ),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        await saveChecklist(input.protocolId, input.stage, input.items, input.warehouseEquipmentId);
        // Update verdict & status (only for non-equipment-specific saves or when all equipment done)
        const hasUnset = input.items.some(i => i.answer === "unset");
        const hasNo = input.items.some(i => i.answer === "no");
        let verdict: "pass" | "fail" | "none" = "none";
        if (input.items.length > 0 && !hasUnset) verdict = hasNo ? "fail" : "pass";
        const patch: any = {};
        if (input.stage === "iq") {
          patch.iqVerdict = verdict;
          if (verdict === "pass") patch.status = "iq_done";
        } else {
          patch.oqVerdict = verdict;
          if (verdict === "pass") patch.status = "oq_done";
        }
        await updateProtocolStatus(ctx.user.id, input.protocolId, patch);
        return { success: true, verdict };
      }),
  }),

  /* -------------------------------------------------------------- */
  /* PV — performance qualification                                 */
  /* -------------------------------------------------------------- */
  pv: router({
    get: protectedProcedure
      .input(z.object({ protocolId: z.number() }))
      .query(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        const session = await getPVSession(input.protocolId);
        const loggers = await listLoggers(input.protocolId);
        // Strip series payload to keep response small. Series is reloaded in detail view if needed.
        // Compute earliest sensor recording start time across all loggers
        const earliestSensorTs = loggers.reduce<number | null>((min, l) => {
          const ts = l.firstTs as number | null;
          if (!ts) return min;
          return min === null ? ts : Math.min(min, ts);
        }, null);
        return {
          session,
          loggers: loggers.map(l => ({ ...l, series: undefined })),
          earliestSensorTs,
        };
      }),
    getLoggerSeries: protectedProcedure
      .input(z.object({ protocolId: z.number(), loggerId: z.number() }))
      .query(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        const all = await listLoggers(input.protocolId);
        const l = all.find(x => x.id === input.loggerId);
        if (!l) throw new TRPCError({ code: "NOT_FOUND" });
        return l.series as { ts: number[]; temp: number[] } | null;
      }),
    saveSession: protectedProcedure
      .input(
        z.object({
          protocolId: z.number(),
          tempMode: TEMP_MODE_SCHEMA.optional(),
          startAt: z.number().nullable().optional(),
          endAt: z.number().nullable().optional(),
          minDurationHours: z.number().int().positive().optional(),
          minSensorCount: z.number().int().positive().optional(),
          samplingStepMinutes: z.number().int().nonnegative().nullable().optional(),
          customMin: z.number().nullable().optional(),
          customMax: z.number().nullable().optional(),
          coolingUnitPos: z.object({ x: z.number(), y: z.number() }).nullable().optional(),
          doorPos: z.object({ x: z.number(), y: z.number() }).nullable().optional(),
          floorPlanObjects: z.array(z.object({
            id: z.string(),
            type: z.string(),
            xPct: z.number(),
            yPct: z.number(),
            widthPct: z.number(),
            heightPct: z.number(),
            heightM: z.number().optional().default(0),
            rotation: z.number(),
            label: z.string(),
            sensors: z.array(z.object({
              sensorId: z.string(),
              heightFromFloor: z.number(),
            })).optional(),
          })).nullable().optional(),
          // Room dimensions saved alongside the plan (warehouse only)
          roomLengthM: z.union([z.number(), z.string()]).nullable().optional(),
          roomWidthM: z.union([z.number(), z.string()]).nullable().optional(),
          roomHeightM: z.union([z.number(), z.string()]).nullable().optional(),
          // Plan screenshot stored in S3
          planImageKey: z.string().nullable().optional(),
          planImageUrl: z.string().nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        const { protocolId, customMin, customMax, samplingStepMinutes, coolingUnitPos, doorPos, floorPlanObjects, roomLengthM, roomWidthM, roomHeightM, planImageKey, planImageUrl, ...rest } = input;
        const patch: any = { ...rest };
        if (customMin !== undefined) patch.customMin = customMin === null ? null : String(customMin);
        if (customMax !== undefined) patch.customMax = customMax === null ? null : String(customMax);
        if (samplingStepMinutes !== undefined) {
          patch.samplingStepMinutes =
            samplingStepMinutes === null || samplingStepMinutes === 0 ? null : samplingStepMinutes;
        }
        if (coolingUnitPos !== undefined) patch.coolingUnitPos = coolingUnitPos;
        if (doorPos !== undefined) patch.doorPos = doorPos;
        if (floorPlanObjects !== undefined) patch.floorPlanObjects = floorPlanObjects;
        const coerceDec = (v: any) => v === undefined ? undefined : (v === null || v === "" ? null : String(v));
        const cL = coerceDec(roomLengthM);
        const cW = coerceDec(roomWidthM);
        const cH = coerceDec(roomHeightM);
        if (cL !== undefined) patch.roomLengthM = cL;
        if (cW !== undefined) patch.roomWidthM = cW;
        if (cH !== undefined) patch.roomHeightM = cH;
        if (planImageKey !== undefined) patch.planImageKey = planImageKey;
        if (planImageUrl !== undefined) patch.planImageUrl = planImageUrl;
        await updatePVSession(protocolId, patch);
        // After window/step change, recompute every logger’s displayed stats so
        // MIN/AVG/MAX/MKT reflect only the [startAt; endAt] window at the
        // chosen sampling step.
        const session = await getPVSession(protocolId);
        if (session) {
          const gi = await getGeneralInfo(protocolId);
          const { min, max } = rangeFor(
            session.tempMode || gi?.tempMode || "2-8",
            session.customMin ? Number(session.customMin) : null,
            session.customMax ? Number(session.customMax) : null,
          );
          const loggers = await listLoggers(protocolId);
          for (const l of loggers) {
            const series = (l.series as any) as { ts: number[]; temp: number[] } | null;
            if (!series || !series.ts) continue;
            const clipped = clipSeries(series, session.startAt, session.endAt);
            const resampled = resampleSeries(clipped, session.samplingStepMinutes);
            const stats = computeStats(resampled.temp);
            const deviations = l.role === "internal"
              ? findDeviations(resampled.ts, resampled.temp, min, max)
              : [];
            await updateLogger(l.id, {
              pointCount: resampled.temp.length,
              minVal: stats ? String(stats.min) : null,
              maxVal: stats ? String(stats.max) : null,
              avgVal: stats ? String(stats.avg) : null,
              stdVal: stats ? String(stats.std) : null,
              mktVal: stats ? String(stats.mkt) : null,
              deviations: deviations as any,
            });
          }
        }
        return { success: true };
      }),
    savePlanImage: protectedProcedure
      .input(
        z.object({
          protocolId: z.number(),
          // PNG data URL (data:image/png;base64,...) or raw base64 string
          dataUrl: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        const session = await getPVSession(input.protocolId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "PV session missing" });
        const m = input.dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
        const base64 = m ? m[2] : input.dataUrl;
        const ext = m && (m[1] === "jpeg" || m[1] === "jpg") ? "jpg" : "png";
        const ct = ext === "png" ? "image/png" : "image/jpeg";
        const buf = Buffer.from(base64, "base64");
        const fileKey = `protocol-${input.protocolId}/plan-${Date.now()}.${ext}`;
        const { key, url } = await storagePut(fileKey, buf, ct);
        await updatePVSession(input.protocolId, { planImageKey: key, planImageUrl: url } as any);
        return { key, url };
      }),
    uploadLogger: protectedProcedure
      .input(
        z.object({
          protocolId: z.number(),
          fileName: z.string(),
          contentType: z.string().optional(),
          base64: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        const session = await getPVSession(input.protocolId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "PV session missing" });
        const buf = Buffer.from(input.base64, "base64");
        const series = parseLoggerBuffer(buf, input.fileName);
        if (series.ts.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Не удалось распознать данные логгера. Проверьте формат файла (требуются столбцы: метка времени и температура).",
          });
        }
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const { key, url } = await storagePut(
          `protocol-${input.protocolId}/loggers/${safeName}`,
          buf,
          input.contentType || "application/octet-stream",
        );
        const existing = await listLoggers(input.protocolId);
        // Use sensor name from file metadata if available, otherwise fall back to D1/D2/D3
        const fallbackLabel = `D${existing.length + 1}`;
        const label = series.sensorName
          ? series.sensorName.slice(0, 64) // respect DB varchar(64) limit
          : fallbackLabel;
        // Honor already-configured test window + sampling step so the first
        // numbers the user sees match what the final analysis will report.
        const clipped = clipSeries(series, session.startAt, session.endAt);
        const resampled = resampleSeries(clipped, session.samplingStepMinutes);
        const stats = computeStats(resampled.temp);
        const firstTs = series.ts.length > 0 ? series.ts[0] : null;
        
        const logger = await insertLogger({
          pvSessionId: session.id,
          protocolId: input.protocolId,
          fileKey: key,
          fileUrl: url,
          fileName: input.fileName,
          label,
          customName: null,
          role: "internal",
          pointCount: series.temp.length,
          firstTs,
          minVal: stats ? String(stats.min) : null,
          maxVal: stats ? String(stats.max) : null,
          avgVal: stats ? String(stats.avg) : null,
          stdVal: stats ? String(stats.std) : null,
          mktVal: stats ? String(stats.mkt) : null,
          series: series as any,
          deviations: [] as any,
        });
        
        // Auto-link sensor if label matches a sensor number in the database
        if (series.sensorName) {
          try {
            const sensors = await listSensors();
            const matchingSensor = sensors.find(s => s.number.toLowerCase() === series.sensorName?.toLowerCase());
            if (matchingSensor) {
              await addSensorToProtocol(input.protocolId, matchingSensor.id);
            }
          } catch (err) {
            // Silently fail if sensor not found or already linked
          }
        }
        
        return logger;
      }),
    updateLogger: protectedProcedure
      .input(
        z.object({
          protocolId: z.number(),
          loggerId: z.number(),
          customName: z.string().nullable().optional(),
          role: z.enum(["internal", "external"]).optional(),
          position: z.string().max(32).nullable().optional(), // accepts legacy (top/middle/bottom/door/external/unset), ISPE IDs (C1-C8, W1-W4, V1-V3) and warehouse cell IDs (L{row}-c{col}-t{tier})
          posX: z.number().nullable().optional(),
          posY: z.number().nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        const patch: any = {};
        if (input.customName !== undefined) patch.customName = input.customName;
        if (input.role !== undefined) patch.role = input.role;
        if (input.position !== undefined) patch.position = input.position === null ? "unset" : input.position;
        if (input.posX !== undefined) patch.posX = input.posX;
        if (input.posY !== undefined) patch.posY = input.posY;
        return updateLogger(input.loggerId, patch);
      }),
    deleteLogger: protectedProcedure
      .input(z.object({ protocolId: z.number(), loggerId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        await deleteLogger(input.loggerId);
        return { success: true };
      }),
    autoDetectExternal: protectedProcedure
      .input(z.object({ protocolId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        const session = await getPVSession(input.protocolId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        const loggers = await listLoggers(input.protocolId);
        const gi0 = await getGeneralInfo(input.protocolId);
        const { min, max } = rangeFor(
          session.tempMode || gi0?.tempMode || "2-8",
          session.customMin ? Number(session.customMin) : null,
          session.customMax ? Number(session.customMax) : null,
        );
        const externals = detectExternalSensors(
          loggers.map(l => ({ avg: Number(l.avgVal || 0) })),
          min,
          max,
        );
        for (let i = 0; i < loggers.length; i++) {
          const role = externals.includes(i) ? "external" : "internal";
          if (loggers[i].role !== role) {
            await updateLogger(loggers[i].id, { role });
          }
        }
        return { externals };
      }),
    analyze: protectedProcedure
      .input(z.object({ protocolId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        const session = await getPVSession(input.protocolId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        const loggers = await listLoggers(input.protocolId);
        const gi1 = await getGeneralInfo(input.protocolId);
        const { min, max } = rangeFor(
          session.tempMode || gi1?.tempMode || "2-8",
          session.customMin ? Number(session.customMin) : null,
          session.customMax ? Number(session.customMax) : null,
        );

        // Recompute stats with clipped + resampled range, store deviations
        for (const l of loggers) {
          const series = (l.series as any) as { ts: number[]; temp: number[] } | null;
          if (!series || !series.ts) continue;
          const clipped = clipSeries(series, session.startAt, session.endAt);
          const resampled = resampleSeries(clipped, session.samplingStepMinutes);
          const stats = computeStats(resampled.temp);
          const deviations = l.role === "internal"
            ? findDeviations(resampled.ts, resampled.temp, min, max)
            : [];
          await updateLogger(l.id, {
            pointCount: resampled.temp.length,
            minVal: stats ? String(stats.min) : null,
            maxVal: stats ? String(stats.max) : null,
            avgVal: stats ? String(stats.avg) : null,
            stdVal: stats ? String(stats.std) : null,
            mktVal: stats ? String(stats.mkt) : null,
            deviations: deviations as any,
          });
        }

        // Re-fetch updated loggers
        const updated = await listLoggers(input.protocolId);
        const internals = updated.filter(l => l.role === "internal");
        const failureReasons: string[] = [];

        // Acceptance: all internal sensors within range
        for (const l of internals) {
          const devCount = ((l.deviations as any[]) || []).length;
          if (devCount > 0) {
            failureReasons.push(
              `Датчик ${l.label}${l.customName ? " («" + l.customName + "»)" : ""}: ${devCount} отклонений за пределы режима ${min}…${max} °C.`,
            );
          }
          const mkt = Number(l.mktVal || 0);
          if (mkt < min || mkt > max) {
            failureReasons.push(
              `Датчик ${l.label}${l.customName ? " («" + l.customName + "»)" : ""}: MKT ${mkt.toFixed(2)} °C вне режима ${min}…${max} °C.`,
            );
          }
        }
        // Duration
        const durationHours = session.startAt && session.endAt
          ? (session.endAt - session.startAt) / 3600000
          : 0;
        if (durationHours < session.minDurationHours) {
          failureReasons.push(
            `Длительность испытания ${durationHours.toFixed(1)} ч меньше минимальной (${session.minDurationHours} ч).`,
          );
        }
        // Sensor count
        if (internals.length < session.minSensorCount) {
          failureReasons.push(
            `Использовано ${internals.length} внутренних датчиков, требуется не менее ${session.minSensorCount}.`,
          );
        }

        const verdict: "pass" | "fail" = failureReasons.length === 0 && internals.length > 0 ? "pass" : "fail";

        await updatePVSession(input.protocolId, {
          verdict,
          stats: { min, max, internalCount: internals.length, durationHours } as any,
          deviations: failureReasons as any,
        });
        await updateProtocolStatus(ctx.user.id, input.protocolId, {
          pvVerdict: verdict,
          status: verdict === "pass" ? "completed" : "pv_done",
        });

        return { verdict, failureReasons };
      }),

    /**
     * Sliding-window analysis: finds the best contiguous time window of
     * `durationHours` length across all uploaded loggers.
     * Scoring per window (lower = better):
     *   - gaps: missing data points across all sensors (weight 1000 each)
     *   - out-of-range points (weight 100 each)
     *   - std deviation across all sensors in window (weight 1)
     * Returns the window with the lowest score plus a human-readable explanation.
     */
    findOptimalWindow: protectedProcedure
      .input(
        z.object({
          protocolId: z.number(),
          durationHours: z.number().positive(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        const loggers = await listLoggers(input.protocolId);
        const internals = loggers.filter(l => l.role === "internal");
        if (internals.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Нет загруженных внутренних датчиков" });
        }

        const session = await getPVSession(input.protocolId);
        const gi = await getGeneralInfo(input.protocolId);
        const { min: rangeMin, max: rangeMax } = rangeFor(
          session?.tempMode || gi?.tempMode || "2-8",
          session?.customMin ? Number(session.customMin) : null,
          session?.customMax ? Number(session.customMax) : null,
        );

        // Load series for each internal logger
        const allSeries: { ts: number[]; temp: number[] }[] = [];
        for (const l of internals) {
          const s = l.series as { ts: number[]; temp: number[] } | null;
          if (s && s.ts && s.ts.length > 0) allSeries.push(s);
        }
        if (allSeries.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Нет данных в загруженных датчиках" });
        }

        // Determine common time range across all sensors
        const globalStart = Math.max(...allSeries.map(s => s.ts[0]));
        const globalEnd   = Math.min(...allSeries.map(s => s.ts[s.ts.length - 1]));
        const durationMs  = input.durationHours * 3600_000;

        if (globalEnd - globalStart < durationMs) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Общий диапазон данных (${((globalEnd - globalStart) / 3600_000).toFixed(1)} ч) меньше запрошенного окна (${input.durationHours} ч)`,
          });
        }

        // Determine typical sampling interval (median gap between consecutive timestamps)
        const allGaps: number[] = [];
        for (const s of allSeries) {
          for (let i = 1; i < Math.min(s.ts.length, 200); i++) {
            allGaps.push(s.ts[i] - s.ts[i - 1]);
          }
        }
        allGaps.sort((a, b) => a - b);
        const stepMs = allGaps[Math.floor(allGaps.length / 2)] || 600_000; // default 10 min
        const slideStepMs = stepMs; // slide one measurement step at a time

        // Expected number of points per sensor in window
        const expectedPoints = Math.round(durationMs / stepMs);

        let bestScore = Infinity;
        let bestStart = globalStart;
        let bestEnd   = globalStart + durationMs;
        let bestGaps  = 0;
        let bestOutOfRange = 0;
        let bestStd   = 0;

        // Slide window
        for (let wStart = globalStart; wStart + durationMs <= globalEnd; wStart += slideStepMs) {
          const wEnd = wStart + durationMs;
          let totalGaps = 0;
          let totalOutOfRange = 0;
          const allTemps: number[] = [];

          for (const s of allSeries) {
            const clipped = clipSeries(s, wStart, wEnd);
            const gaps = Math.max(0, expectedPoints - clipped.temp.length);
            totalGaps += gaps;
            for (const t of clipped.temp) {
              if (t < rangeMin || t > rangeMax) totalOutOfRange++;
              allTemps.push(t);
            }
          }

          // Compute std across all sensors in window
          let std = 0;
          if (allTemps.length > 1) {
            const mean = allTemps.reduce((a, b) => a + b, 0) / allTemps.length;
            std = Math.sqrt(allTemps.reduce((a, b) => a + (b - mean) ** 2, 0) / allTemps.length);
          }

          const score = totalGaps * 1000 + totalOutOfRange * 100 + std;
          if (score < bestScore) {
            bestScore = score;
            bestStart = wStart;
            bestEnd   = wEnd;
            bestGaps  = totalGaps;
            bestOutOfRange = totalOutOfRange;
            bestStd   = std;
          }
        }

        // Build explanation
        const parts: string[] = [];
        if (bestGaps === 0) {
          parts.push("пропусков нет");
        } else {
          parts.push(`пропусков: ${bestGaps}`);
        }
        if (bestOutOfRange === 0) {
          parts.push("все точки в допустимом диапазоне");
        } else {
          parts.push(`${bestOutOfRange} точек вне диапазона ${rangeMin}…${rangeMax} °C`);
        }
        parts.push(`стабильность ±${bestStd.toFixed(2)} °C`);

        return {
          startAt: bestStart,
          endAt: bestEnd,
          explanation: parts.join(" · "),
          gapCount: bestGaps,
          outOfRangeCount: bestOutOfRange,
          stdDev: bestStd,
        };
      }),
  }),

  /* -------------------------------------------------------------- */
  /* PDF generation                                                 */
  /* -------------------------------------------------------------- */
  report: router({
    generate: protectedProcedure
      .input(z.object({ protocolId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const protocol = await ownProtocol(ctx.user.id, input.protocolId);
        let org = await getOrganization(ctx.user.id, protocol.organizationId);
        if (!org) {
          const userCompanies = await getUserCompanies(ctx.user.id);
          if (userCompanies.length > 0) org = await getOrganizationByCompany(userCompanies[0].id, protocol.organizationId);
          if (!org) {
            const adminCompanies = await listCompanies(ctx.user.id);
            if (adminCompanies.length > 0) org = await getOrganizationByCompany(adminCompanies[0].id, protocol.organizationId);
          }
        }
        if (!org) throw new TRPCError({ code: "NOT_FOUND" });
        const gi = await getGeneralInfo(input.protocolId);
        const iqItems = await listChecklist(input.protocolId, "iq");
        const oqItems = await listChecklist(input.protocolId, "oq");
        const session = await getPVSession(input.protocolId);
        const loggers = await listLoggers(input.protocolId);

        const tempMode = session?.tempMode || gi?.tempMode || "2-8";
        const guardedRange = rangeFor(
          tempMode,
          session?.customMin ? Number(session.customMin) : null,
          session?.customMax ? Number(session.customMax) : null,
        );
        const { min, max } = guardedRange;

        const preparedLoggers = loggers.map(l => {
          const raw = (l.series as any) || { ts: [], temp: [] };
          const clipped = clipSeries(raw, session?.startAt ?? null, session?.endAt ?? null);
          const resampled = resampleSeries(clipped, session?.samplingStepMinutes);
          const stats = computeStats(resampled.temp);
          const deviations = l.role === "internal"
            ? findDeviations(resampled.ts, resampled.temp, min, max)
            : [];
          return { logger: l, series: resampled, stats, deviations };
        });

        // Determine hot/cold critical sensors among internals
        const internalIdx: number[] = [];
        loggers.forEach((l, i) => {
          if (l.role === "internal") internalIdx.push(i);
        });
        let hotIdx: number | null = null;
        let coldIdx: number | null = null;
        let hotMax = -Infinity;
        let coldMin = Infinity;
        for (const i of internalIdx) {
          const stats = preparedLoggers[i]?.stats;
          const avg = stats?.avg ?? Number(loggers[i].avgVal || 0);
          if (avg > hotMax) {
            hotMax = avg;
            hotIdx = i;
          }
          const minVal = stats?.min ?? Number(loggers[i].minVal || 0);
          if (minVal < coldMin) {
            coldMin = minVal;
            coldIdx = i;
          }
        }
        const extIndices: number[] = [];
        loggers.forEach((l, i) => {
          if (l.role === "external") extIndices.push(i);
        });

        const reportFailureReasons: string[] = [];
        const reportInternalLoggers = preparedLoggers.filter(l => l.logger.role === "internal");
        const hasPVData = preparedLoggers.some(l => l.series.temp.length > 0);
        const isWarehouseProtocol = protocol.equipmentType === "warehouse";
        if (hasPVData) {
          for (const item of reportInternalLoggers) {
            const l = item.logger;
            const devCount = item.deviations.length;
            if (devCount > 0) {
              reportFailureReasons.push(
                `Датчик ${l.label}${l.customName ? " («" + l.customName + "»)" : ""}: ${devCount} отклонений за пределы режима ${min}…${max} °C.`,
              );
            }
            const mkt = item.stats?.mkt ?? Number(l.mktVal || 0);
            if (mkt < min || mkt > max) {
              reportFailureReasons.push(
                `Датчик ${l.label}${l.customName ? " («" + l.customName + "»)" : ""}: MKT ${mkt.toFixed(2)} °C вне режима ${min}…${max} °C.`,
              );
            }
          }

          const durationHours = session?.startAt && session?.endAt
            ? (session.endAt - session.startAt) / 3600000
            : 0;
          const minDurationHours = session?.minDurationHours ?? (isWarehouseProtocol ? 168 : 72);
          const minSensorCount = session?.minSensorCount ?? (isWarehouseProtocol ? 8 : 9);
          if (durationHours < minDurationHours) {
            reportFailureReasons.push(
              `Длительность испытания ${durationHours.toFixed(1)} ч меньше минимальной (${minDurationHours} ч).`,
            );
          }
          if (reportInternalLoggers.length < minSensorCount) {
            reportFailureReasons.push(
              `Использовано ${reportInternalLoggers.length} внутренних датчиков, требуется не менее ${minSensorCount}.`,
            );
          }
        }
        const reportPVVerdict: "pass" | "fail" | "none" = hasPVData
          ? (reportFailureReasons.length === 0 && reportInternalLoggers.length > 0 ? "pass" : "fail")
          : protocol.pvVerdict;
        const reportPVFailureReasons = hasPVData
          ? reportFailureReasons
          : (((session?.deviations as any) as string[]) || []);

        // Logo
        let logoBuffer: Buffer | null = null;
        if (org.logoKey) {
          try {
            logoBuffer = (await storageReadBuffer(org.logoKey)).data;
          } catch (e) {
            console.warn("Logo fetch failed:", e);
          }
        }

        // Plan image (warehouse floor plan screenshot)
        let planImageBuffer: Buffer | null = null;
        const planImgKey = (session as any)?.planImageKey ?? null;
        if (planImgKey) {
          try {
            planImageBuffer = (await storageReadBuffer(planImgKey)).data;
          } catch (e) {
            console.warn("Plan image fetch failed:", e);
          }
        }

        // Fetch excursion study data
        const excursionSession = await getExcursionSession(input.protocolId);
        const excursionLoggers = excursionSession?.enabled
          ? await listExcursionLoggers(input.protocolId)
          : [];
        // Fetch warehouse-specific data (sections + equipment)
        const warehouseSectionsMap = isWarehouseProtocol
          ? await getWarehouseSections(input.protocolId)
          : {};
        const warehouseEquipmentList = isWarehouseProtocol
          ? await listWarehouseEquipment(input.protocolId)
          : [];
        const reportActor =
          pickReportActorFromGeneralInfo(gi) ||
          normalizeReportActorName(org.responsible) ||
          normalizeReportActorName(ctx.user.name) ||
          normalizeReportActorName(ctx.user.email) ||
          "—";
        const generatedAt = new Date().toISOString();
        const revisionDate =
          nonBlankString(gi?.validationDate) ||
          nonBlankString(gi?.reportDate) ||
          generatedAt;

        const reportInput: ReportInput = {
          org: {
            name: org.name,
            bin: org.bin,
            addressLegal: org.addressLegal,
            addressFact: org.addressFact,
            responsible: org.responsible,
            phone: org.phone,
            email: org.email,
            logoBuffer,
          },
          protocol: {
            number: protocol.number,
            createdAt: protocol.createdAt,
            equipmentType: protocol.equipmentType ?? null,
            customEquipmentName: protocol.customEquipmentName ?? null,
          },
          generalInfo: gi
            ? {
                ...gi,
                commissionMembers: (gi.commissionMembers as any) || null,
              }
            : null,
          signatoriesPart1: (gi?.signatoriesPart1 as any) || null,
          signatoriesPart2: (gi?.signatoriesPart2 as any) || null,
          planDeviations: (gi?.planDeviations as string | undefined) || undefined,
          recommendations: (gi?.recommendations as string | undefined) || undefined,
          reportDate: (gi?.reportDate as string | undefined) || null,
          documentValidityPeriod: (gi?.documentValidityPeriod as string | undefined) || null,
          dataIntegrity: {
            revision: "01",
            preparedBy: reportActor,
            generatedBy: reportActor,
            generatedAt,
            stages: [],
            revisionHistory: [
              {
                revision: "01",
                date: revisionDate,
                change: "Первичная редакция протокола и отчёта о квалификации.",
                author: reportActor,
              },
            ],
          },
          iq: {
            ...(isWarehouseProtocol ? WAREHOUSE_STAGE_TEMPLATES.iq : STAGE_TEMPLATES.iq),
            items: iqItems.map(i => ({
              questionIndex: i.questionIndex,
              questionText: i.questionText,
              answer: i.answer,
              comment: i.comment,
              updatedAt: i.updatedAt,
            })).sort((a, b) => a.questionIndex - b.questionIndex),
            verdict: protocol.iqVerdict,
          },
          oq: {
            ...(isWarehouseProtocol ? WAREHOUSE_STAGE_TEMPLATES.oq : STAGE_TEMPLATES.oq),
            items: oqItems.map(i => ({
              questionIndex: i.questionIndex,
              questionText: i.questionText,
              answer: i.answer,
              comment: i.comment,
              updatedAt: i.updatedAt,
            })).sort((a, b) => a.questionIndex - b.questionIndex),
            verdict: protocol.oqVerdict,
          },
          pv: {
            ...(isWarehouseProtocol ? WAREHOUSE_STAGE_TEMPLATES.pv : STAGE_TEMPLATES.pv),
            tempMode,
            rawRangeMin: guardedRange.rawMin,
            rawRangeMax: guardedRange.rawMax,
            sensorAccuracy: guardedRange.sensorAccuracy,
            rangeMin: min,
            rangeMax: max,
            startAt: session?.startAt ?? null,
            endAt: session?.endAt ?? null,
            minDurationHours: session?.minDurationHours ?? (isWarehouseProtocol ? 168 : 72),
            minSensorCount: session?.minSensorCount ?? (isWarehouseProtocol ? 8 : 9),
            loggers: preparedLoggers.map(({ logger: l, series, stats, deviations }) => ({
              id: l.id,
              label: l.label,
              customName: l.customName,
              role: l.role,
              pointCount: series.temp.length || l.pointCount,
              min: stats?.min ?? Number(l.minVal || 0),
              max: stats?.max ?? Number(l.maxVal || 0),
              avg: stats?.avg ?? Number(l.avgVal || 0),
              std: stats?.std ?? Number(l.stdVal || 0),
              mkt: stats?.mkt ?? Number(l.mktVal || 0),
              createdAt: l.createdAt,
              series,
              deviations: deviations as any,
            })),
            verdict: reportPVVerdict,
            failureReasons: reportPVFailureReasons,
            hotIdx,
            coldIdx,
             extIndices,
            samplingStepMinutes: session?.samplingStepMinutes ?? null,
            updatedAt: session?.updatedAt ?? null,
          },
          pvLoggers: loggers.map(l => ({
            id: l.id,
            label: l.label,
            customName: l.customName,
            role: l.role,
            position: l.position,
            posX: l.posX != null ? Number(l.posX) : null,
            posY: l.posY != null ? Number(l.posY) : null,
          })),
          coolingUnitPos: session?.coolingUnitPos as any,
          doorPos: session?.doorPos as any,
          floorPlanObjects: session?.floorPlanObjects as any,
          // Saved plan screenshot (preferred over vector drawing in PDF) — pass as Buffer for PDFKit
          planImageUrl: planImageBuffer as any,
          // Room dims from pvSession (preferred over generalInfo.whXxx)
          pvRoomLengthM: (session as any)?.roomLengthM ? Number((session as any).roomLengthM) : null,
          pvRoomWidthM: (session as any)?.roomWidthM ? Number((session as any).roomWidthM) : null,
          pvRoomHeightM: (session as any)?.roomHeightM ? Number((session as any).roomHeightM) : null,
          excursion: excursionSession?.enabled
            ? {
                enabled: !!excursionSession.enabled,
                timingVsPv: excursionSession.timingVsPv ?? null,
                test1Enabled: !!excursionSession.test1Enabled,
                test2Enabled: !!excursionSession.test2Enabled,
                test3Enabled: !!excursionSession.test3Enabled,
                recordStartAt: excursionSession.recordStartAt ?? null,
                recordEndAt: excursionSession.recordEndAt ?? null,
                t1PowerOnAt: excursionSession.t1PowerOnAt ?? null,
                t1TStableAt: excursionSession.t1TStableAt ?? null,
                t1DurationSec: excursionSession.t1DurationSec ?? null,
                t1CriticalSensor: excursionSession.t1CriticalSensor ?? null,
                t1SensorEntries: (excursionSession.t1SensorEntries as any) ?? null,
                t2DoorOpenAt: excursionSession.t2DoorOpenAt ?? null,
                t2DoorCloseAt: excursionSession.t2DoorCloseAt ?? null,
                t2TBreakAt: excursionSession.t2TBreakAt ?? null,
                t2DurationSec: excursionSession.t2DurationSec ?? null,
                t2CriticalSensor: excursionSession.t2CriticalSensor ?? null,
                t2NoBreak: !!excursionSession.t2NoBreak,
                t2SensorBreaks: (excursionSession.t2SensorBreaks as any) ?? null,
                t3PowerOffAt: excursionSession.t3PowerOffAt ?? null,
                t3TestEndAt: excursionSession.t3TestEndAt ?? null,
                t3TBreakAt: excursionSession.t3TBreakAt ?? null,
                t3DurationSec: excursionSession.t3DurationSec ?? null,
                t3CriticalSensor: excursionSession.t3CriticalSensor ?? null,
                t3NoBreak: !!excursionSession.t3NoBreak,
                t3SensorBreaks: (excursionSession.t3SensorBreaks as any) ?? null,
                warnings: (excursionSession.warnings as string[]) ?? [],
                loggers: excursionLoggers.map(l => ({
                  label: l.label,
                  role: l.role,
                  series: (l.series as { ts: number[]; temp: number[] }) ?? { ts: [], temp: [] },
                })),
              }
            : null,
          warehouseSections: Object.keys(warehouseSectionsMap).length > 0 ? warehouseSectionsMap : undefined,
          warehouseEquipment: warehouseEquipmentList.length > 0
            ? warehouseEquipmentList.map(e => ({
                name: e.name,
                manufacturer: e.manufacturer,
                model: e.model,
                serial: e.serial,
                inventory: e.inventory,
                purpose: e.purpose,
              }))
            : undefined,
        };
        
        // Load protocol sensors if any are linked
        try {
          const protocolSensors = await getProtocolSensors(input.protocolId);
          if (protocolSensors && protocolSensors.length > 0) {
            reportInput.protocolSensors = protocolSensors.map(ps => ({
              id: ps.id,
              number: ps.number,
              calibrationDate: ps.calibrationDate,
              nextCalibrationDate: ps.nextCalibrationDate,
              status: ps.status,
            }));
          }
        } catch (err) {
          // Silently fail if sensors not found
        }
        
        const buffer = await generateProtocolPdf(reportInput);
        const { key, url } = await storagePut(
          `protocol-${input.protocolId}/report-${protocol.number}-${Date.now()}.pdf`,
          buffer,
          "application/pdf",
        );
         return { key, url, size: buffer.length };
      }),
  }),

  /* -------------------------------------------------------------- */
  /* Question Templates                                             */
  /* -------------------------------------------------------------- */
  questionTemplates: router({
    list: protectedProcedure
      .input(z.object({
        equipmentType: z.string().optional(),
        /** For warehouse: filter by equipment kind. Pass null for general warehouse questions, a kind string for kind-specific. */
        equipmentKind: z.string().nullable().optional(),
      }).optional())
      .query(({ input }) => listAllQuestionTemplates(input?.equipmentType, input?.equipmentKind)),
    create: protectedProcedure
      .input(
        z.object({
          stage: z.enum(["iq", "oq"]),
          text: z.string().min(1),
          equipmentType: z.enum(["refrigerator", "auto-refrigerator", "warehouse", "other"]).optional(),
          /** For warehouse: which equipment kind these questions apply to */
          equipmentKind: z.enum(["conditioner", "ventilation", "heat_curtain", "chiller", "fan_coil", "other"]).nullable().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const eqType = input.equipmentType || "refrigerator";
        const eqKind = input.equipmentKind ?? null;
        // Place new question at the end of its stage+equipmentType+equipmentKind
        const all = await listAllQuestionTemplates(eqType, eqKind);
        const stageItems = all.filter(q => q.stage === input.stage);
        const maxOrd = stageItems.length > 0 ? Math.max(...stageItems.map(q => q.ord)) : 0;
        return insertQuestionTemplate({ stage: input.stage, text: input.text, ord: maxOrd + 10, equipmentType: eqType as any, equipmentKind: eqKind });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          text: z.string().min(1).optional(),
          ord: z.number().optional(),
        }),
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateQuestionTemplate(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteQuestionTemplate(input.id)),

    reorder: protectedProcedure
      .input(
        z.object({
          // Array of { id, ord } pairs representing the new order
          items: z.array(z.object({ id: z.number(), ord: z.number() })),
        }),
      )
      .mutation(async ({ input }) => {
        await Promise.all(
          input.items.map(item => updateQuestionTemplate(item.id, { ord: item.ord })),
        );
        return { success: true };
      }),
    seedDefaults: protectedProcedure
      .input(z.object({
        equipmentType: z.enum(["refrigerator", "auto-refrigerator", "warehouse", "other"]),
        overwrite: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const existing = await listAllQuestionTemplates(input.equipmentType);
        if (existing.length > 0 && !input.overwrite) {
          return { inserted: 0, skipped: existing.length };
        }
        // Delete existing if overwrite
        if (input.overwrite && existing.length > 0) {
          await Promise.all(existing.map(q => deleteQuestionTemplate(q.id)));
        }
        const iqQuestions = defaultQuestionsFor("iq", input.equipmentType);
        const oqQuestions = defaultQuestionsFor("oq", input.equipmentType);
        const inserts: Promise<unknown>[] = [];
        iqQuestions.forEach((text, i) => {
          inserts.push(insertQuestionTemplate({ stage: "iq", text, ord: (i + 1) * 10, equipmentType: input.equipmentType as any }));
        });
        oqQuestions.forEach((text, i) => {
          inserts.push(insertQuestionTemplate({ stage: "oq", text, ord: (i + 1) * 10, equipmentType: input.equipmentType as any }));
        });
        await Promise.all(inserts);
        return { inserted: iqQuestions.length + oqQuestions.length, skipped: 0 };
      }),
  }),

  /* -------------------------------------------------------------- */
  /* Excursion Study                                                */
  /* -------------------------------------------------------------- */
  excursion: router({
    getSession: protectedProcedure
      .input(z.object({ protocolId: z.number() }))
      .query(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        return getExcursionSession(input.protocolId);
      }),

    saveSession: protectedProcedure
      .input(
        z.object({
          protocolId: z.number(),
          enabled: z.boolean().optional(),
          timingVsPv: z.enum(["before_pv", "after_pv", "independent"]).optional(),
          test1Enabled: z.boolean().optional(),
          test2Enabled: z.boolean().optional(),
          test3Enabled: z.boolean().optional(),
          recordStartAt: z.number().nullable().optional(),
          recordEndAt: z.number().nullable().optional(),
          t1PowerOnAt: z.number().nullable().optional(),
          t1StabilizationThresholdMinutes: z.number().optional(),
          t2DoorOpenAt: z.number().nullable().optional(),
          t2DoorCloseAt: z.number().nullable().optional(),
          t3PowerOffAt: z.number().nullable().optional(),
          t3TestEndAt: z.number().nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        const { protocolId, ...rest } = input;
        const boolToInt = (v?: boolean) => (v === undefined ? undefined : v ? 1 : 0);
        return upsertExcursionSession(protocolId, {
          ...rest,
          enabled: boolToInt(rest.enabled),
          test1Enabled: boolToInt(rest.test1Enabled),
          test2Enabled: boolToInt(rest.test2Enabled),
          test3Enabled: boolToInt(rest.test3Enabled),
        });
      }),

    listLoggers: protectedProcedure
      .input(z.object({ protocolId: z.number() }))
      .query(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        return listExcursionLoggers(input.protocolId);
      }),

    uploadLogger: protectedProcedure
      .input(
        z.object({
          protocolId: z.number(),
          fileName: z.string(),
          contentType: z.string().optional(),
          base64: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        let session = await getExcursionSession(input.protocolId);
        if (!session) {
          session = await upsertExcursionSession(input.protocolId, { enabled: 1 });
        }
        if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Excursion session missing" });
        const buf = Buffer.from(input.base64, "base64");
        const series = parseLoggerBuffer(buf, input.fileName);
        if (series.ts.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Не удалось распознать данные логгера. Проверьте формат файла.",
          });
        }
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const { key, url } = await storagePut(
          `protocol-${input.protocolId}/excursion/${safeName}`,
          buf,
          input.contentType || "application/octet-stream",
        );
        const existing = await listExcursionLoggers(input.protocolId);
        const fallbackLabel = `D${existing.length + 1}`;
        const label = series.sensorName ? series.sensorName.slice(0, 64) : fallbackLabel;
        const logger = await insertExcursionLogger({
          excursionSessionId: session.id,
          protocolId: input.protocolId,
          fileKey: key,
          fileUrl: url,
          fileName: input.fileName,
          label,
          customName: undefined,
          role: "internal",
          pointCount: series.ts.length,
          series: series as any,
        });

        if (series.sensorName) {
          try {
            const sensors = await listSensors();
            const matchingSensor = sensors.find(s => s.number.toLowerCase() === series.sensorName?.toLowerCase());
            if (matchingSensor) {
              await addSensorToProtocol(input.protocolId, matchingSensor.id);
            }
          } catch (err) {
            // Sensor registry is optional; logger upload must not fail if no match exists.
          }
        }

        return logger;
      }),

    updateLogger: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          protocolId: z.number(),
          customName: z.string().optional(),
          role: z.enum(["internal", "external"]).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        return updateExcursionLogger(input.id, { customName: input.customName, role: input.role });
      }),

    deleteLogger: protectedProcedure
      .input(z.object({ id: z.number(), protocolId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        await deleteExcursionLogger(input.id);
        return { success: true };
      }),

    runCalculations: protectedProcedure
      .input(z.object({ protocolId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const protocol = await ownProtocol(ctx.user.id, input.protocolId);
        const session = await getExcursionSession(input.protocolId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Excursion session missing" });
        const loggers = await listExcursionLoggers(input.protocolId);
        if (!loggers.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Нет загруженных файлов" });

        const gi = await getGeneralInfo(input.protocolId);
        const tempMode = gi?.tempMode ?? "2-8";
        const guardedRange = rangeFor(tempMode);
        const tempRange: [number, number] = [guardedRange.min, guardedRange.max];

        const sensors = loggers.map(l => ({
          label: l.customName || l.label,
          ts: ((l.series as any)?.ts ?? []) as number[],
          temp: ((l.series as any)?.temp ?? []) as number[],
          role: l.role as "internal" | "external",
        }));

        const allWarnings: string[] = [];
        const updates: Partial<Parameters<typeof upsertExcursionSession>[1]> = {};

        if (session.test1Enabled && session.t1PowerOnAt) {
          const t1StableUntilAt =
            session.t2DoorOpenAt ??
            session.t3PowerOffAt ??
            session.recordEndAt ??
            undefined;
          const r = calcTest1(
            sensors,
            session.t1PowerOnAt,
            session.t1StabilizationThresholdMinutes ?? 15,
            tempRange,
            t1StableUntilAt,
          );
          updates.t1TStableAt = r.tStableAt;
          updates.t1DurationSec = r.durationSec;
          updates.t1CriticalSensor = r.criticalSensor;
          updates.t1SensorEntries = r.sensorEntries as any;
          allWarnings.push(...r.warnings);
        }

        if (session.test2Enabled && session.t2DoorOpenAt && session.t2DoorCloseAt) {
          const r = calcTest2(
            sensors,
            session.t2DoorOpenAt,
            session.t2DoorCloseAt,
            tempRange,
          );
          updates.t2TBreakAt = r.tBreakAt;
          updates.t2DurationSec = r.durationSec;
          updates.t2CriticalSensor = r.criticalSensor;
          updates.t2NoBreak = r.noBreak ? 1 : 0;
          updates.t2SensorBreaks = r.sensorBreaks as any;
          allWarnings.push(...r.warnings);
        }

        if (session.test3Enabled && session.t3PowerOffAt) {
          const r = calcTest3(
            sensors,
            session.t3PowerOffAt,
            session.recordEndAt ?? Date.now(),
            tempRange,
            session.t3TestEndAt ?? undefined,
          );
          updates.t3TBreakAt = r.tBreakAt;
          updates.t3DurationSec = r.durationSec;
          updates.t3CriticalSensor = r.criticalSensor;
          updates.t3NoBreak = r.noBreak ? 1 : 0;
          updates.t3SensorBreaks = r.sensorBreaks as any;
          allWarnings.push(...r.warnings);
        }

        updates.warnings = allWarnings as any;
        return upsertExcursionSession(input.protocolId, updates);
      }),
  }),

  /* -------------------------------------------------------------- */
  /* Company management (admin + user)                              */
  /* -------------------------------------------------------------- */
  companies: router({
    // Admin: create a new company
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return createCompany({ name: input.name, createdByAdminId: ctx.user.id });
      }),

    // Admin: list all companies they created
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return listCompanies(ctx.user.id);
    }),

    // Admin: get company details
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const c = await getCompany(input.id);
        if (!c) throw new TRPCError({ code: "NOT_FOUND" });
        return c;
      }),

    // Admin: list members of a company
    listMembers: protectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return listCompanyMembers(input.companyId);
      }),

    // Admin: invite a user by openId to a company
    inviteUser: protectedProcedure
      .input(z.object({ companyId: z.number(), openId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await import("./db");
        const targetUser = await db.getUserByOpenId(input.openId);
        if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "Пользователь не найден" });
        const existing = await getCompanyMember(targetUser.id, input.companyId);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Пользователь уже приглашён" });
        return inviteUserToCompany({ userId: targetUser.id, companyId: input.companyId });
      }),

    // Admin: invite by email
    inviteByEmail: protectedProcedure
      .input(z.object({ companyId: z.number(), email: z.string().email() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await import("./db");
        const targetUser = await db.getUserByEmail(input.email);
        if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "Пользователь с таким email не найден. Попросите его сначала войти в систему." });
        const existing = await getCompanyMember(targetUser.id, input.companyId);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Пользователь уже приглашён" });
        return inviteUserToCompany({ userId: targetUser.id, companyId: input.companyId });
      }),

    // Admin: approve a pending member
    approveMember: protectedProcedure
      .input(z.object({ memberId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        await approveCompanyMember(input.memberId, ctx.user.id);
        return { success: true };
      }),

    // Admin: reject a pending member
    rejectMember: protectedProcedure
      .input(z.object({ memberId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        await rejectCompanyMember(input.memberId, ctx.user.id);
        return { success: true };
      }),

    // Admin: remove a member from company
    removeMember: protectedProcedure
      .input(z.object({ memberId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        await removeCompanyMember(input.memberId);
        return { success: true };
      }),

    // Admin: list all protocols across all companies
    allProtocols: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return listAllProtocolsForAdmin();
    }),

    // Admin: list protocols for a specific company
    protocolsByCompany: protectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return listProtocolsByCompany(input.companyId);
      }),

    // User: get their own companies
    myCompanies: protectedProcedure.query(async ({ ctx }) => {
      return getUserCompanies(ctx.user.id);
    }),
    myMembershipStatus: protectedProcedure.query(async ({ ctx }) => {
      const approved = await getUserCompanies(ctx.user.id);
      const pending = await getUserPendingMemberships(ctx.user.id);
      return {
        isApproved: approved.length > 0,
        isPending: pending.length > 0,
        pendingCompanies: pending.map(p => p.companyName),
        approvedCompanies: approved.map(c => c.name),
      };
    }),
  }),

  /* ---------------------------------------------------------------- */
  /* Warehouse Protocol Sections (ЕАЭК Рек. №8 — разделы 1–7)        */
  /* ---------------------------------------------------------------- */
  warehouseSections: router({
    /** Get all section texts for a protocol, returns map {sectionKey: content} */
    get: protectedProcedure
      .input(z.object({ protocolId: z.number() }))
      .query(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        return getWarehouseSections(input.protocolId);
      }),

    /** Save (upsert) map of {sectionKey: content} */
    save: protectedProcedure
      .input(
        z.object({
          protocolId: z.number(),
          sections: z.record(z.string(), z.string()),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        await saveWarehouseSections(input.protocolId, input.sections);
        return { success: true };
      }),
  }),

  /* ---------------------------------------------------------------- */
  /* Warehouse Equipment — Section 5 (multiple items per protocol)    */
  /* ---------------------------------------------------------------- */
  warehouseEquipment: router({
    list: protectedProcedure
      .input(z.object({ protocolId: z.number() }))
      .query(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        return listWarehouseEquipment(input.protocolId);
      }),

    create: protectedProcedure
      .input(
        z.object({
          protocolId: z.number(),
          kind: z.enum(["conditioner","ventilation","heat_curtain","chiller","fan_coil","other"]).optional().default("other"),
          name: z.string().min(1),
          manufacturer: z.string().optional().nullable(),
          model: z.string().optional().nullable(),
          serial: z.string().optional().nullable(),
          inventory: z.string().optional().nullable(),
          purpose: z.string().optional().nullable(),
          ord: z.number().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        return createWarehouseEquipment({
          protocolId: input.protocolId,
          kind: input.kind,
          name: input.name,
          manufacturer: input.manufacturer ?? null,
          model: input.model ?? null,
          serial: input.serial ?? null,
          inventory: input.inventory ?? null,
          purpose: input.purpose ?? null,
          ord: input.ord ?? 0,
        });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          kind: z.enum(["conditioner","ventilation","heat_curtain","chiller","fan_coil","other"]).optional(),
          name: z.string().min(1).optional(),
          manufacturer: z.string().optional().nullable(),
          model: z.string().optional().nullable(),
          serial: z.string().optional().nullable(),
          inventory: z.string().optional().nullable(),
          purpose: z.string().optional().nullable(),
          ord: z.number().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateWarehouseEquipment(id, data);
        return { success: true };
      }),

    /** Returns auto-generated IQ/OQ questions based on equipment kinds in the object.
     * Uses DB templates when available, falls back to static defaults. */
    autoQuestions: protectedProcedure
      .input(z.object({ protocolId: z.number(), stage: z.enum(["iq", "oq"]) }))
      .query(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        const equipment = await listWarehouseEquipment(input.protocolId);
        // Build question list using DB templates where available
        // Common questions (equipmentKind=null) first, then kind-specific
        const commonDbTemplates = await listAllQuestionTemplates("warehouse", null);
        const commonQuestions = commonDbTemplates
          .filter(t => t.stage === input.stage)
          .sort((a, b) => a.ord - b.ord)
          .map(t => t.text);
        // Collect unique kinds
        const seenKinds: string[] = [];
        const seen = new Set<string>();
        for (const eq of equipment) {
          const k = eq.kind ?? "other";
          if (!seen.has(k)) { seen.add(k); seenKinds.push(k); }
        }
        // For each kind, check if DB templates exist; fall back to static
        const kindQuestions: string[] = [];
        for (const kind of seenKinds) {
          const kindDbTemplates = await listAllQuestionTemplates("warehouse", kind);
          const kindStageTemplates = kindDbTemplates
            .filter(t => t.stage === input.stage)
            .sort((a, b) => a.ord - b.ord)
            .map(t => t.text);
          if (kindStageTemplates.length > 0) {
            // Use DB templates — they already have the kind label if user wants it
            kindQuestions.push(...kindStageTemplates);
          } else {
            // Fall back to static defaults with kind label prefix
            const staticQuestions = buildWarehouseQuestions([{ kind }], input.stage);
            // staticQuestions includes common questions too — extract only kind-specific
            // by taking questions after the common block
            const staticCommon = buildWarehouseQuestions([], input.stage);
            const kindOnly = staticQuestions.slice(staticCommon.length);
            kindQuestions.push(...kindOnly);
          }
        }
        // Combine: if no DB common templates, fall back to static common
        if (commonQuestions.length === 0 && kindQuestions.length === 0) {
          // Full fallback to static
          return buildWarehouseQuestions(equipment, input.stage);
        }
        const finalCommon = commonQuestions.length > 0
          ? commonQuestions
          : buildWarehouseQuestions([], input.stage); // static common
        return [...finalCommon, ...kindQuestions];
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteWarehouseEquipment(input.id);
        return { success: true };
      }),
  }),

  /* -------------------------------------------------------------- */
  /* Sensors (Calibration Tracking)                                  */
  /* -------------------------------------------------------------- */
  sensors: router({
    list: protectedProcedure
      .query(async ({ ctx }) => {
        // Portal-level sensors, no organization check needed
        return listSensors();
      }),

    create: protectedProcedure
      .input(z.object({
        number: z.string().min(1),
        calibrationDate: z.string(),
        nextCalibrationDate: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createSensor({
          number: input.number,
          calibrationDate: input.calibrationDate,
          nextCalibrationDate: input.nextCalibrationDate,
          status: "active",
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        number: z.string().optional(),
        calibrationDate: z.string().optional(),
        nextCalibrationDate: z.string().optional(),
        status: z.enum(["active", "expiring_soon", "expired"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const sensor = await getSensor(input.id);
        if (!sensor) throw new TRPCError({ code: "NOT_FOUND" });
        return updateSensor(input.id, {
          number: input.number,
          calibrationDate: input.calibrationDate,
          nextCalibrationDate: input.nextCalibrationDate,
          status: input.status,
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const sensor = await getSensor(input.id);
        if (!sensor) throw new TRPCError({ code: "NOT_FOUND" });
        await deleteSensor(input.id);
        return { success: true };
      }),

    expiringIn30Days: protectedProcedure
      .query(async ({ ctx }) => {
        return getSensorsExpiringIn30Days();
      }),

    bulkCreate: protectedProcedure
      .input(z.array(z.object({
        number: z.string().min(1),
        calibrationDate: z.string(),
        nextCalibrationDate: z.string(),
      })))
      .mutation(async ({ ctx, input }) => {
        return bulkCreateSensors(input);
      }),
  }),

  protocolSensors: router({
    list: protectedProcedure
      .input(z.object({ protocolId: z.number() }))
      .query(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        return getProtocolSensors(input.protocolId);
      }),

    add: protectedProcedure
      .input(z.object({
        protocolId: z.number(),
        sensorId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        return addSensorToProtocol(input.protocolId, input.sensorId);
      }),

    remove: protectedProcedure
      .input(z.object({
        protocolId: z.number(),
        sensorId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        await removeProtocolSensor(input.protocolId, input.sensorId);
        return { success: true };
      }),

    clear: protectedProcedure
      .input(z.object({ protocolId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await ownProtocol(ctx.user.id, input.protocolId);
        await clearProtocolSensors(input.protocolId);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
