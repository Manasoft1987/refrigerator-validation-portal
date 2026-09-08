import { describe, expect, it } from "vitest";
import {
  DEFAULT_IQ_QUESTIONS,
  DEFAULT_IQ_QUESTIONS_AUTO_REFRIGERATOR,
  DEFAULT_IQ_QUESTIONS_CHAMBER,
  CHAMBER_STAGE_TEMPLATES,
  STAGE_TEMPLATES,
  AUTO_REFRIGERATOR_STAGE_TEMPLATES,
  AUTO_REFRIGERATOR_KG_STAGE_TEMPLATES,
  DEFAULT_IQ_QUESTIONS_WAREHOUSE,
  DEFAULT_OQ_QUESTIONS,
  DEFAULT_OQ_QUESTIONS_AUTO_REFRIGERATOR,
  DEFAULT_OQ_QUESTIONS_CHAMBER,
  DEFAULT_OQ_QUESTIONS_WAREHOUSE,
  findWarehouseChecklistQuestionMatch,
} from "../shared/validation";
import { buildWarehouseQuestions } from "./warehouseQuestions";

describe("auto-refrigerator question defaults", () => {
  it("provides the requested IQ checklist", () => {
    expect(DEFAULT_IQ_QUESTIONS_AUTO_REFRIGERATOR).toHaveLength(13);
    expect(DEFAULT_IQ_QUESTIONS_AUTO_REFRIGERATOR[3]).toBe("Совпадает ли VIN транспорта с документами?");
    expect(DEFAULT_IQ_QUESTIONS_AUTO_REFRIGERATOR[12]).toBe(
      "Отсутствуют ли видимые повреждения в кузове или двери авторефрижератора?",
    );
  });

  it("provides the requested OQ checklist", () => {
    expect(DEFAULT_OQ_QUESTIONS_AUTO_REFRIGERATOR).toHaveLength(5);
    expect(DEFAULT_OQ_QUESTIONS_AUTO_REFRIGERATOR[1]).toBe(
      "Работает ли пульт управления в кабине без ошибок?",
    );
    expect(DEFAULT_OQ_QUESTIONS_AUTO_REFRIGERATOR[4]).toBe(
      "Корректно ли работает индикация на дисплее (температура, режимы)?",
    );
  });
});

describe("cold chamber question defaults", () => {
  it("provides chamber-specific IQ questions without vehicle checks", () => {
    expect(DEFAULT_IQ_QUESTIONS_CHAMBER).toHaveLength(9);
    expect(DEFAULT_IQ_QUESTIONS_CHAMBER[0]).toContain("холодильная камера");
    expect(DEFAULT_IQ_QUESTIONS_CHAMBER.join(" ")).not.toMatch(/VIN|государственный номер|водительское удостоверение|страховой полис/i);
  });

  it("provides chamber-specific OQ questions", () => {
    expect(DEFAULT_OQ_QUESTIONS_CHAMBER).toHaveLength(8);
    expect(DEFAULT_OQ_QUESTIONS_CHAMBER[4]).toContain("циркуляция воздуха");
    expect(DEFAULT_OQ_QUESTIONS_CHAMBER[6]).toContain("открытой двери");
  });
});

describe("cold chamber stage text", () => {
  it("does not contain transport-specific wording", () => {
    const text = Object.values(CHAMBER_STAGE_TEMPLATES)
      .flatMap(stage => [stage.purpose, stage.description, stage.criteria])
      .join(" ");
    expect(text).not.toMatch(/авторефрижератор|кузов|кабина|транспортное средство|VIN/i);
    expect(text).not.toMatch(/проектной документац/i);
    expect(text).toMatch(/ЕЭК №8|24–72/);
    expect(text).toContain("ISPE Good Practice Guide");
    expect(text).toContain("холодильная камера");
  });
});

describe("generic (refrigerator) stage text", () => {
  it("does not leak auto-refrigerator wording", () => {
    const text = Object.values(STAGE_TEMPLATES)
      .flatMap(stage => [stage.purpose, stage.description, stage.criteria])
      .join(" ");
    expect(text).not.toMatch(/авторефрижератор|кузов|кабин|транспортное средство|VIN/i);
    expect(text).toContain("холодильное оборудование");
  });
});

describe("auto-refrigerator stage text", () => {
  it("keeps its transport-specific wording", () => {
    const text = Object.values(AUTO_REFRIGERATOR_STAGE_TEMPLATES)
      .flatMap(stage => [stage.purpose, stage.description, stage.criteria])
      .join(" ");
    expect(text).toMatch(/авторефрижератор/i);
    expect(text).toMatch(/кузов/i);
  });
});

describe("Kyrgyzstan auto-refrigerator stage text", () => {
  it("uses EAEU and Kyrgyzstan regulatory wording without Kazakhstan NPA", () => {
    const text = Object.values(AUTO_REFRIGERATOR_KG_STAGE_TEMPLATES)
      .flatMap(stage => [stage.purpose, stage.description, stage.criteria])
      .join(" ");
    expect(text).toContain("Евразийской экономической комиссии");
    expect(text).toContain("Кыргызской Республики");
    expect(text).not.toMatch(/Республики Казахстан|Казахстан/i);
  });
});

describe("refrigerator question defaults", () => {
  it("provides the requested IQ checklist", () => {
    expect(DEFAULT_IQ_QUESTIONS).toHaveLength(7);
    expect(DEFAULT_IQ_QUESTIONS[0]).toBe(
      "Идентифицируется ли оборудование биркой (инвентарный/серийный номер)?",
    );
    expect(DEFAULT_IQ_QUESTIONS[6]).toBe(
      "Проведена ли проверка отсутствия видимых повреждений корпуса и уплотнителей?",
    );
  });

  it("provides the requested OQ checklist", () => {
    expect(DEFAULT_OQ_QUESTIONS).toHaveLength(5);
    expect(DEFAULT_OQ_QUESTIONS[1]).toBe(
      "Корректно ли работает индикация на дисплее (температура, режимы) или ручка термостата?",
    );
    expect(DEFAULT_OQ_QUESTIONS[4]).toBe(
      "Отсутствуют ли посторонние шумы / вибрации, указывающие на неисправность?",
    );
  });
});

describe("warehouse question defaults", () => {
  it("provides the requested IQ checklist", () => {
    expect(DEFAULT_IQ_QUESTIONS_WAREHOUSE).toHaveLength(10);
    expect(DEFAULT_IQ_QUESTIONS_WAREHOUSE[0]).toBe(
      "Идентифицируется ли помещение табличкой или вывеской?",
    );
    expect(DEFAULT_IQ_QUESTIONS_WAREHOUSE[9]).toBe(
      "Отсутствуют ли видимые признаки повреждений или дефектов монтажа?",
    );
  });

  it("provides the requested OQ checklist", () => {
    expect(DEFAULT_OQ_QUESTIONS_WAREHOUSE).toHaveLength(8);
    expect(DEFAULT_OQ_QUESTIONS_WAREHOUSE[0]).toBe(
      "Запускается ли оборудование в штатном режиме?",
    );
    expect(DEFAULT_OQ_QUESTIONS_WAREHOUSE[7]).toBe(
      "Оборудование включается и издает характерный звук работы вентилятора, компрессора?",
    );
  });
});

describe("warehouse conditioner question defaults", () => {
  it("uses the fixed warehouse IQ block without extra equipment-kind questions", () => {
    const questions = buildWarehouseQuestions([{ kind: "conditioner" }], "iq");
    const conditionerQuestions = questions.filter((question) => question.startsWith("[Кондиционер]"));

    expect(questions).toEqual(DEFAULT_IQ_QUESTIONS_WAREHOUSE);
    expect(conditionerQuestions).toHaveLength(0);
  });

  it("uses the fixed warehouse OQ block without extra equipment-kind questions", () => {
    const questions = buildWarehouseQuestions([{ kind: "conditioner" }], "oq");
    const conditionerQuestions = questions.filter((question) => question.startsWith("[Кондиционер]"));

    expect(questions).toEqual(DEFAULT_OQ_QUESTIONS_WAREHOUSE);
    expect(conditionerQuestions).toHaveLength(0);
  });

  it("matches legacy warehouse questions by meaning when updating existing protocols", () => {
    const savedItems = [
      {
        questionText: "Имеется ли на помещение технический паспорт?",
        answer: "yes",
      },
      {
        questionText: "[Кондиционер] Оборудование включается и издает характерный звук работы вентилятора, компрессора?",
        answer: "no",
      },
    ];

    expect(
      findWarehouseChecklistQuestionMatch(
        savedItems,
        "Имеется ли на объект технический паспорт?",
      )?.item.answer,
    ).toBe("yes");
    expect(
      findWarehouseChecklistQuestionMatch(
        savedItems,
        "Оборудование включается и издает характерный звук работы вентилятора, компрессора?",
      )?.item.answer,
    ).toBe("no");
  });
});
