import { describe, expect, it } from "vitest";
import {
  DEFAULT_IQ_QUESTIONS,
  DEFAULT_IQ_QUESTIONS_AUTO_REFRIGERATOR,
  DEFAULT_IQ_QUESTIONS_CHAMBER,
  DEFAULT_IQ_QUESTIONS_WAREHOUSE,
  DEFAULT_OQ_QUESTIONS,
  DEFAULT_OQ_QUESTIONS_AUTO_REFRIGERATOR,
  DEFAULT_OQ_QUESTIONS_CHAMBER,
  DEFAULT_OQ_QUESTIONS_WAREHOUSE,
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
    expect(DEFAULT_IQ_QUESTIONS_WAREHOUSE).toHaveLength(8);
    expect(DEFAULT_IQ_QUESTIONS_WAREHOUSE[0]).toBe(
      "Идентифицируется ли помещение табличкой или вывеской?",
    );
    expect(DEFAULT_IQ_QUESTIONS_WAREHOUSE[7]).toBe(
      "Соответствуют ли внутренняя отделка и санитарное состояние помещения требованиям СанПиН?",
    );
  });

  it("provides the requested OQ checklist", () => {
    expect(DEFAULT_OQ_QUESTIONS_WAREHOUSE).toHaveLength(10);
    expect(DEFAULT_OQ_QUESTIONS_WAREHOUSE[0]).toBe(
      "Запускается ли всё оборудование зоны (холодильные установки, кондиционеры, обогреватели) в штатном режиме?",
    );
    expect(DEFAULT_OQ_QUESTIONS_WAREHOUSE[9]).toBe(
      "Отсутствуют ли посторонние шумы/вибрации, свидетельствующие о неисправностях оборудования зоны?",
    );
  });
});

describe("warehouse conditioner question defaults", () => {
  it("adds the requested conditioner IQ block", () => {
    const questions = buildWarehouseQuestions([{ kind: "conditioner" }], "iq");
    const conditionerQuestions = questions.filter((question) => question.startsWith("[Кондиционер]"));

    expect(conditionerQuestions).toHaveLength(5);
    expect(conditionerQuestions[0]).toBe(
      "[Кондиционер] Идентифицируется ли оборудование биркой (инвентарный/серийный номер)?",
    );
    expect(conditionerQuestions[4]).toBe(
      "[Кондиционер] Отсутствуют ли видимые признаки повреждений или дефектов монтажа?",
    );
  });

  it("adds the requested conditioner OQ block", () => {
    const questions = buildWarehouseQuestions([{ kind: "conditioner" }], "oq");
    const conditionerQuestions = questions.filter((question) => question.startsWith("[Кондиционер]"));

    expect(conditionerQuestions).toHaveLength(5);
    expect(conditionerQuestions[1]).toBe(
      "[Кондиционер] Оборудование включается и издает характерный звук работы вентилятора, компрессора?",
    );
    expect(conditionerQuestions[4]).toBe(
      "[Кондиционер] Отсутствуют ли посторонние шумы / вибрации, указывающие на неисправность?",
    );
  });
});
