import { describe, expect, it, vi } from "vitest";
import PDFDocument from "pdfkit";
import {
  buildChamberScene,
  CHAMBER_POSITIONS,
  chamberSamples,
  chamberInterpolate,
  chamberPlacementIssues,
  chamberMetrologyIssues,
  chamberProject,
  CHAMBER_VIEW,
} from "../shared/chamberMapping";
import { generateProtocolPdf } from "./pdfReport";
import { chamberReportFixture } from "./chamberReport.fixture";

describe("chamber placement shared by portal and PDF", () => {
  it("uses an enlarged rectangular prism without clipping logger annotations", () => {
    const origin = chamberProject(0, 0, 0);
    const long = chamberProject(1, 0, 0);
    const short = chamberProject(0, 1, 0);
    expect(
      Math.hypot(long[0] - origin[0], long[1] - origin[1])
    ).toBeGreaterThan(
      2 * Math.hypot(short[0] - origin[0], short[1] - origin[1])
    );
    expect(long[0] - short[0]).toBeGreaterThanOrEqual(650);
    for (const mode of ["plan", "actual", "temperature"] as const) {
      for (const p of buildChamberScene(
        chamberReportFixture().pvLoggers!,
        mode
      )) {
        if (p.kind !== "circle") continue;
        expect(p.x - p.r).toBeGreaterThanOrEqual(0);
        expect(p.x + p.r).toBeLessThanOrEqual(CHAMBER_VIEW.width);
        expect(p.y - p.r).toBeGreaterThanOrEqual(0);
        expect(p.y + p.r + 43).toBeLessThanOrEqual(CHAMBER_VIEW.height);
      }
    }
  });
  it("requires valid metrology and accuracy for every logger at the study date", () => {
    const input = chamberReportFixture();
    const loggers = input.pvLoggers!;
    const sensors = input.protocolSensors!;
    const date = input.generalInfo!.validationDate!;
    expect(chamberMetrologyIssues(loggers, sensors, date)).toEqual([]);
    expect(
      chamberMetrologyIssues(loggers, sensors.slice(1), date)
    ).toHaveLength(1);
    expect(
      chamberMetrologyIssues(
        loggers,
        sensors.map((s, i) =>
          i === 0 ? { ...s, nextCalibrationDate: "2020-01-01" } : s
        ),
        date
      )
    ).toHaveLength(1);
    expect(
      chamberMetrologyIssues(
        loggers,
        sensors.map((s, i) => (i === 0 ? { ...s, accuracyC: "0.6" } : s)),
        date
      )
    ).toHaveLength(1);
    expect(
      chamberMetrologyIssues(
        loggers,
        sensors.map((s, i) => (i === 0 ? { ...s, accuracyC: "0,5" } : s)),
        date
      )
    ).toEqual([]);
  });
  it("preserves all 15 legacy point IDs and distinct coordinates", () => {
    expect(CHAMBER_POSITIONS).toHaveLength(15);
    expect(new Set(CHAMBER_POSITIONS.map(p => p.id)).size).toBe(15);
    expect(
      new Set(CHAMBER_POSITIONS.map(p => `${p.x},${p.y},${p.z}`)).size
    ).toBe(15);
    expect(CHAMBER_POSITIONS.filter(p => p.z === 0)).toHaveLength(5);
    expect(CHAMBER_POSITIONS.filter(p => p.z === 0.5)).toHaveLength(5);
    expect(CHAMBER_POSITIONS.filter(p => p.z === 1)).toHaveLength(5);
  });
  it("anchors the heat field to measurement points and excludes the external logger", () => {
    const l = chamberReportFixture().pvLoggers!;
    const samples = chamberSamples(l);
    expect(samples).toHaveLength(15);
    for (const p of samples)
      expect(chamberInterpolate(samples, p.x, p.y, p.z)).toBe(p.avg);
    expect(
      chamberSamples([
        ...l,
        {
          id: 100,
          label: "external 100",
          role: "external",
          position: "C1",
          avg: 100,
        },
      ])
    ).toEqual(samples);
    expect(chamberInterpolate([], 0, 0, 0)).toBeNull();
    const markers = (mode: "plan" | "actual" | "temperature") =>
      buildChamberScene(l, mode)
        .filter(p => p.kind === "circle" && p.position)
        .map(p =>
          p.kind === "circle" ? { position: p.position, x: p.x, y: p.y } : null
        );
    expect(markers("actual")).toEqual(markers("plan"));
    expect(markers("temperature")).toEqual(markers("plan"));
  });
  it("detects incomplete, duplicate and unassigned positions without automatic relocation", () => {
    const l = chamberReportFixture().pvLoggers!;
    expect(chamberPlacementIssues(l)).toEqual([]);
    expect(chamberPlacementIssues(l.slice(0, 8)).join(" ")).toContain(
      "не менее 15"
    );
    expect(chamberPlacementIssues(l.slice(0, 15)).join(" ")).toContain(
      "внешний регистратор"
    );
    expect(
      chamberPlacementIssues(
        l.map((p, i) => (i === 1 ? { ...p, position: "C1" } : p))
      ).join(" ")
    ).toContain("Несколько регистраторов");
    expect(
      chamberPlacementIssues(
        l.map((p, i) => (i === 1 ? { ...p, position: "unset" } : p))
      ).join(" ")
    ).toContain("без подтверждённой позиции");
  });
});

describe("dedicated chamber EEC report", () => {
  it("includes three schemes, preserves custom answers, references and annexes in order", async () => {
    const seen: string[] = [];
    const original = PDFDocument.prototype.text;
    const spy = vi
      .spyOn(PDFDocument.prototype, "text")
      .mockImplementation(function (
        this: PDFKit.PDFDocument,
        ...args: Parameters<PDFKit.PDFDocument["text"]>
      ) {
        if (typeof args[0] === "string") seen.push(args[0]);
        return original.apply(this, args);
      });
    try {
      const input = chamberReportFixture();
      input.iq.items[0] = {
        ...input.iq.items[0],
        questionText: "Индивидуальная проверка камеры",
        answer: "na",
        comment: "Индивидуальное обоснование",
      };
      const pdf = await generateProtocolPdf(input);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
      const text = seen.join("\n");
      expect(text).toContain("20.04.2026 №8");
      expect(text).toContain("03.11.2016 №80");
      expect(text).toContain("Индивидуальная проверка камеры");
      expect(text).toContain("Индивидуальное обоснование");
      expect(text).not.toContain("GPP");
      expect(text).toContain("∑");
      expect(text).toContain("σ");
      expect(text).toContain("ΔH");
      expect(text).toContain("Средняя кинетическая температура (MKT)");
      expect(text).not.toContain("sqrt(sum(");
      expect(text).not.toContain("MKT = -dH/R");
      expect(text).not.toContain("Приказом");
      expect(text).toContain("не менее 24 часов");
      expect(text).not.toMatch(/24[–−-]72|не менее 72|выбрано 72|не менее 7 суток/);
      expect(text).toContain("Справочная информация.");
      expect(text).toContain("от 24 до 72 часов или более при необходимости");
      expect(text).toContain("Критерий длительности настоящего протокола — не менее 24 часов непрерывно.");
      expect(text).toContain("Испытание завершено с положительным заключением.");
      expect(input.pv.minDurationHours).toBe(72); // Reading must not rewrite legacy data.
      expect(input.pv.endAt! - input.pv.startAt!).toBe(24 * 3600_000);
      const plan = text.indexOf("Схема 1.");
      const actual = text.indexOf("Схема 2.");
      const stats = text.indexOf("9.1. Сводная");
      const heat = text.indexOf("Схема 3.");
      expect(plan).toBeGreaterThan(0);
      expect(actual).toBeGreaterThan(plan);
      expect(stats).toBeGreaterThan(actual);
      expect(heat).toBeGreaterThan(stats);
      expect(text.indexOf("Приложение 1. Расположение")).toBeGreaterThan(
        actual
      );
      expect(text).toContain("Приложение 2. Информация");
      expect(text).toContain("0.30 м");
      expect(input.pv.hotIdx).toBe(0); // generator must not mutate the caller
      seen.length = 0;
      input.protocolSensors = [];
      input.pvLoggers = input.pvLoggers!.slice(0, 8);
      await generateProtocolPdf(input);
      const incompleteText = seen.join("\n");
      expect(incompleteText).toContain(
        "Пригодность холодильной камеры по совокупности IQ/OQ и PQ/PV не подтверждена"
      );
      expect(incompleteText).toContain(
        "метрологическая пригодность на дату испытания не подтверждена"
      );
      expect(incompleteText).not.toContain(
        "Испытание завершено с положительным заключением."
      );
      expect(input.pv.verdict).toBe("pass");
      seen.length = 0;
      const short = chamberReportFixture();
      short.pv.endAt = short.pv.startAt! + 23 * 3600_000;
      await generateProtocolPdf(short);
      expect(seen.join("\n")).toContain("Продолжительность записи меньше требуемого минимума — 24 часов.");
      expect(seen.join("\n")).not.toContain("Испытание завершено с положительным заключением.");
    } finally {
      spy.mockRestore();
    }
  }, 60000);

  it("uses saved chamber study metadata in section 2.3 even for legacy records", async () => {
    const seen: string[] = [];
    const original = PDFDocument.prototype.text;
    const spy = vi
      .spyOn(PDFDocument.prototype, "text")
      .mockImplementation(function (
        this: PDFKit.PDFDocument,
        ...args: Parameters<PDFKit.PDFDocument["text"]>
      ) {
        if (typeof args[0] === "string") seen.push(args[0]);
        return original.apply(this, args);
      });
    try {
      const input = chamberReportFixture();
      input.generalInfo!.basis = null as any;
      input.generalInfo!.qualificationType = "primary";
      input.generalInfo!.season = null;
      input.generalInfo!.whSeason = "warm";
      input.generalInfo!.fillStatus = "loaded";
      input.generalInfo!.loadPercent = "75%";

      await generateProtocolPdf(input);
      const text = seen.join("\n");
      expect(text).toContain("75%");
      expect(text).not.toContain("75%%");
    } finally {
      spy.mockRestore();
    }
  }, 60000);
});
