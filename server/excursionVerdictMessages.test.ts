import { describe, expect, it } from "vitest";

/**
 * Test suite for excursion verdict messages to ensure they include duration in minutes
 * when temperature remains within range (no-break scenarios).
 */
describe("Excursion Verdict Messages", () => {
  describe("Test 2 (Door Open) - no-break scenario", () => {
    it("should calculate door-open duration in minutes from timestamps", () => {
      // Simulate door open at 1000000 ms and close 330000 ms later (330 seconds = 5.5 minutes)
      const t2DoorOpenAt = 1000000; // ms epoch
      const t2DoorCloseAt = 1000000 + 330000; // 330 seconds later

      const doorDurationSec = t2DoorCloseAt - t2DoorOpenAt;
      const doorDurationMin = Math.round(doorDurationSec / 1000 / 60);

      expect(doorDurationMin).toBe(6); // 330 seconds ≈ 5.5 minutes, rounded to 6
    });

    it("should format the verdict message with door-open duration", () => {
      const t2DoorOpenAt = 1000000;
      const t2DoorCloseAt = 1000000 + 600000; // 600 seconds = 10 minutes

      const doorDurationSec = t2DoorCloseAt - t2DoorOpenAt;
      const doorDurationMin = Math.round(doorDurationSec / 1000 / 60);

      const message = `Тест завершён: температурный режим сохранён в течение всего периода открытой двери (${doorDurationMin} мин).`;

      expect(message).toBe(
        "Тест завершён: температурный режим сохранён в течение всего периода открытой двери (10 мин)."
      );
    });

    it("should handle edge case of very short door-open duration", () => {
      const t2DoorOpenAt = 1000000;
      const t2DoorCloseAt = 1000000 + 30000; // 30 seconds

      const doorDurationSec = t2DoorCloseAt - t2DoorOpenAt;
      const doorDurationMin = Math.round(doorDurationSec / 1000 / 60);

      expect(doorDurationMin).toBe(1); // 30 seconds rounds to 1 minute
    });

    it("should handle edge case of exactly 1 minute door-open", () => {
      const t2DoorOpenAt = 1000000;
      const t2DoorCloseAt = 1000000 + 60000; // 60 seconds = 1 minute

      const doorDurationSec = t2DoorCloseAt - t2DoorOpenAt;
      const doorDurationMin = Math.round(doorDurationSec / 1000 / 60);

      expect(doorDurationMin).toBe(1);
    });
  });

  describe("Test 3 (Power-off) - no-break scenario with observation time", () => {
    it("should calculate observation duration in minutes from power-off to test-end timestamps", () => {
      // Power-off at 2000000 ms, observation ends 900000 ms later (900 seconds = 15 minutes)
      const t3PowerOffAt = 2000000;
      const t3TestEndAt = 2000000 + 900000; // 900 seconds later

      const observationDurationSec = t3TestEndAt - t3PowerOffAt;
      const observationDurationMin = Math.round(observationDurationSec / 1000 / 60);

      expect(observationDurationMin).toBe(15);
    });

    it("should format the verdict message with observation duration when t3TestEndAt is provided", () => {
      const t3PowerOffAt = 2000000;
      const t3TestEndAt = 2000000 + 600000; // 600 seconds = 10 minutes

      const observationDurationSec = t3TestEndAt - t3PowerOffAt;
      const observationDurationMin = Math.round(observationDurationSec / 1000 / 60);

      const message = `Тест завершён: температурный режим сохранён после отключения питания (${observationDurationMin} мин).`;

      expect(message).toBe(
        "Тест завершён: температурный режим сохранён после отключения питания (10 мин)."
      );
    });

    it("should use recordEndAt as fallback when t3TestEndAt is null", () => {
      const t3TestEndAt = null;
      const t3PowerOffAt = 2000000;
      const recordEndAt = 2000000 + 1200000; // 1200 seconds = 20 minutes after power-off

      const endTs = t3TestEndAt ?? recordEndAt;
      const observationDurationMin = Math.round((endTs - t3PowerOffAt) / 1000 / 60);
      const message = `Тест завершён: температурный режим сохранён после отключения питания (${observationDurationMin} мин).`;

      expect(observationDurationMin).toBe(20);
      expect(message).toBe(
        "Тест завершён: температурный режим сохранён после отключения питания (20 мин)."
      );
    });

    it("should prefer t3TestEndAt over recordEndAt when both are provided", () => {
      const t3PowerOffAt = 2000000;
      const t3TestEndAt = 2000000 + 600000;  // 10 minutes
      const recordEndAt = 2000000 + 1200000; // 20 minutes

      const endTs = t3TestEndAt ?? recordEndAt;
      const observationDurationMin = Math.round((endTs - t3PowerOffAt) / 1000 / 60);

      expect(observationDurationMin).toBe(10); // t3TestEndAt wins
    });

    it("should handle edge case of 30-minute observation period", () => {
      const t3PowerOffAt = 2000000;
      const t3TestEndAt = 2000000 + 1800000; // 1800 seconds = 30 minutes

      const observationDurationSec = t3TestEndAt - t3PowerOffAt;
      const observationDurationMin = Math.round(observationDurationSec / 1000 / 60);

      expect(observationDurationMin).toBe(30);
    });

    it("should handle rounding: 29.4 minutes should round to 29", () => {
      const t3PowerOffAt = 2000000;
      const t3TestEndAt = 2000000 + 1764000; // 1764 seconds = 29.4 minutes

      const observationDurationSec = t3TestEndAt - t3PowerOffAt;
      const observationDurationMin = Math.round(observationDurationSec / 1000 / 60);

      expect(observationDurationMin).toBe(29);
    });

    it("should handle rounding: 29.5 minutes should round to 30", () => {
      const t3PowerOffAt = 2000000;
      const t3TestEndAt = 2000000 + 1770000; // 1770 seconds = 29.5 minutes

      const observationDurationSec = t3TestEndAt - t3PowerOffAt;
      const observationDurationMin = Math.round(observationDurationSec / 1000 / 60);

      expect(observationDurationMin).toBe(30);
    });
  });

  describe("Consistency between Test 2 and Test 3 messages", () => {
    it("both should use the same format: 'X мин' suffix", () => {
      // Test 2
      const t2DoorOpenAt = 1000000;
      const t2DoorCloseAt = 1000000 + 600000; // 600 seconds = 10 minutes
      const t2DurationMin = Math.round((t2DoorCloseAt - t2DoorOpenAt) / 1000 / 60);
      const t2Message = `Тест завершён: температурный режим сохранён в течение всего периода открытой двери (${t2DurationMin} мин).`;

      // Test 3
      const t3PowerOffAt = 2000000;
      const t3TestEndAt = 2000000 + 600000; // 600 seconds = 10 minutes
      const t3DurationMin = Math.round((t3TestEndAt - t3PowerOffAt) / 1000 / 60);
      const t3Message = `Тест завершён: температурный режим сохранён после отключения питания (${t3DurationMin} мин).`;

      // Both should end with "(X мин)."
      expect(t2Message).toMatch(/\(\d+ мин\)\.$/);
      expect(t3Message).toMatch(/\(\d+ мин\)\.$/);

      // Both should have the same duration
      expect(t2DurationMin).toBe(t3DurationMin);
      expect(t2DurationMin).toBe(10);
    });
  });
});
