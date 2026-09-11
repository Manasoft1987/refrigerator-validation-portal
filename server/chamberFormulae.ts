/** Native vector mathematics: selectable text, scalable fraction/radical rules.
 * Presentation only; the calculation remains in loggerParser.ts.
 */
type Box = {
  w: number;
  h: number;
  axis: number;
  draw(x: number, y: number): void;
};

export function drawChamberFormulae(doc: PDFKit.PDFDocument, margin: number) {
  const ink = "#0f172a";
  const token = (value: string, size = 15): Box => {
    const w = doc.font("body").fontSize(size).widthOfString(value);
    return {
      w,
      h: size * 1.22,
      axis: size * 0.6,
      draw: (x, y) => {
        doc
          .font("body")
          .fontSize(size)
          .fillColor(ink)
          .text(value, x, y, { lineBreak: false });
      },
    };
  };
  const row = (...items: Box[]): Box => {
    const axis = Math.max(...items.map(b => b.axis));
    return {
      w: items.reduce((s, b) => s + b.w, 0) + 4 * (items.length - 1),
      axis,
      h: axis + Math.max(...items.map(b => b.h - b.axis)),
      draw: (x, y) => {
        for (const b of items) {
          b.draw(x, y + axis - b.axis);
          x += b.w + 4;
        }
      },
    };
  };
  const fraction = (a: Box, b: Box): Box => {
    const w = Math.max(a.w, b.w) + 12,
      axis = a.h + 4;
    return {
      w,
      h: a.h + b.h + 9,
      axis,
      draw: (x, y) => {
        a.draw(x + (w - a.w) / 2, y);
        b.draw(x + (w - b.w) / 2, y + axis + 5);
        doc
          .strokeColor(ink)
          .lineWidth(0.8)
          .moveTo(x, y + axis)
          .lineTo(x + w, y + axis)
          .stroke();
      },
    };
  };
  const script = (base: Box, sub?: Box, sup?: Box): Box => {
    const top = sup ? sup.h * 0.75 : 0,
      subY = top + base.h * 0.65;
    return {
      w: base.w + Math.max(sub?.w ?? 0, sup?.w ?? 0) + 1,
      h: Math.max(top + base.h, subY + (sub?.h ?? 0)),
      axis: top + base.axis,
      draw: (x, y) => {
        base.draw(x, y + top);
        sub?.draw(x + base.w + 1, y + subY);
        sup?.draw(x + base.w + 1, y);
      },
    };
  };
  const bar = (b: Box): Box => ({
    ...b,
    h: b.h + 3,
    axis: b.axis + 3,
    draw: (x, y) => {
      b.draw(x, y + 3);
      doc
        .strokeColor(ink)
        .lineWidth(0.7)
        .moveTo(x, y + 1)
        .lineTo(x + b.w, y + 1)
        .stroke();
    },
  });
  const limits = (symbol: string, upper: string, lower: string): Box => {
    const a = token(upper, 9),
      b = token(symbol, 27),
      c = token(lower, 9),
      w = Math.max(a.w, b.w, c.w);
    return {
      w,
      axis: a.h + 2 + b.axis,
      h: a.h + b.h + c.h + 4,
      draw: (x, y) => {
        a.draw(x + (w - a.w) / 2, y);
        b.draw(x + (w - b.w) / 2, y + a.h + 2);
        c.draw(x + (w - c.w) / 2, y + a.h + b.h + 4);
      },
    };
  };
  const brackets = (b: Box): Box => ({
    w: b.w + 16,
    h: b.h + 4,
    axis: b.axis + 2,
    draw: (x, y) => {
      b.draw(x + 8, y + 2);
      doc.strokeColor(ink).lineWidth(0.8);
      doc
        .moveTo(x + 5, y)
        .lineTo(x, y)
        .lineTo(x, y + b.h + 4)
        .lineTo(x + 5, y + b.h + 4)
        .stroke();
      doc
        .moveTo(x + b.w + 11, y)
        .lineTo(x + b.w + 16, y)
        .lineTo(x + b.w + 16, y + b.h + 4)
        .lineTo(x + b.w + 11, y + b.h + 4)
        .stroke();
    },
  });
  const root = (b: Box): Box => ({
    w: b.w + 20,
    h: b.h + 6,
    axis: b.axis + 5,
    draw: (x, y) => {
      b.draw(x + 18, y + 5);
      doc
        .strokeColor(ink)
        .lineWidth(0.9)
        .moveTo(x, y + b.h * 0.58)
        .lineTo(x + 4, y + b.h * 0.5)
        .lineTo(x + 9, y + b.h + 4)
        .lineTo(x + 16, y + 1)
        .lineTo(x + b.w + 20, y + 1)
        .stroke();
    },
  });
  const ti = () => script(token("T"), token("i", 10));
  const avg = () => bar(token("T"));
  const tk = () => script(token("T"), token("K,i", 10));
  const sum = () => limits("∑", "n", "i = 1");
  const eq = () => token("=");
  const formulae: Array<{ title: string; formula: Box; note: string }> = [
    {
      title: "1. Минимальная и максимальная температура",
      formula: row(
        script(token("T"), token("min", 10)),
        eq(),
        script(token("min"), token("1 ≤ i ≤ n", 9)),
        ti(),
        token(";    "),
        script(token("T"), token("max", 10)),
        eq(),
        script(token("max"), token("1 ≤ i ≤ n", 9)),
        ti()
      ),
      note: "Tᵢ — i-е измерение температуры (°C); n — количество значений в выбранном окне PQ/PV. Экстремумы определяются по этому ряду без усреднения.",
    },
    {
      title: "2. Средняя арифметическая температура (Avg)",
      formula: row(avg(), eq(), fraction(token("1"), token("n")), sum(), ti()),
      note: "Сумма всех температур делится на число измерений n. Каждое значение имеет одинаковый вес; результат выражается в °C.",
    },
    {
      title: "3. Стандартное отклонение (Std)",
      formula: row(
        token("σ"),
        eq(),
        root(
          row(
            fraction(token("1"), token("n")),
            sum(),
            script(
              row(token("("), ti(), token("−"), avg(), token(")")),
              undefined,
              token("2", 10)
            )
          )
        )
      ),
      note: "σ — стандартное отклонение, °C. Используется делитель n (описательная статистика всего выбранного ряда), а не n − 1.",
    },
    {
      title: "4. Средняя кинетическая температура (MKT)",
      formula: row(
        script(token("T"), token("MKT", 10)),
        eq(),
        fraction(
          row(token("−"), fraction(token("ΔH"), token("R"))),
          row(
            token("ln"),
            brackets(
              row(
                fraction(token("1", 13), token("n", 13)),
                sum(),
                token("exp"),
                brackets(
                  fraction(
                    token("−ΔH", 13),
                    row(token("R", 13), token("·", 13), tk())
                  )
                )
              )
            )
          )
        ),
        token("− 273,15")
      ),
      note: "Tᴋ,ᵢ = Tᵢ + 273,15 — абсолютная температура, K. ΔH = 83 144 Дж/моль — принятая энергия активации; R = 8,314 Дж/(моль·K). ln — натуральный логарифм; exp(x) = eˣ. Результат MKT выражается в °C. Это дополнительный показатель: он не компенсирует выходы за границы и риск замораживания.",
    },
    {
      title: "5. Суммарная длительность отклонений",
      formula: row(
        token("D"),
        eq(),
        limits("∑", "m", "j = 1"),
        script(token("Δt"), token("j", 10)),
        eq(),
        limits("∑", "m", "j = 1"),
        row(
          token("("),
          script(token("t"), token("end,j", 10)),
          token("−"),
          script(token("t"), token("start,j", 10)),
          token(")")
        )
      ),
      note: "m — число зарегистрированных эпизодов; Δtⱼ — длительность j-го эпизода. Расчёт ведётся отдельно для понижений и превышений. Начало — первая запись за границей; конец — первая следующая запись вне этого эпизода либо последняя доступная запись. Точность длительности ограничена интервалом регистрации.",
    },
  ];
  const width = doc.page.width - 2 * margin;
  for (const item of formulae) {
    const noteHeight = doc
      .font("body")
      .fontSize(9.5)
      .heightOfString(item.note, { width: width - 28 });
    const scale = Math.min(1, (width - 40) / item.formula.w);
    const height = 38 + item.formula.h * scale + 18 + noteHeight + 16;
    if (doc.y + height > doc.page.height - margin - 22) {
      doc.addPage();
      doc.x = margin;
      doc.y = margin + 10;
      doc
        .font("bold")
        .fontSize(12)
        .fillColor(ink)
        .text("Формулы и обозначения (продолжение)", margin, doc.y, { width });
      doc.moveDown(0.8);
    }
    const y = doc.y;
    doc
      .save()
      .roundedRect(margin, y, width, height, 5)
      .fillAndStroke("#f8fafc", "#dbe3ee")
      .restore();
    doc
      .font("bold")
      .fontSize(10.5)
      .fillColor(ink)
      .text(item.title, margin + 14, y + 12, { width: width - 28 });
    doc
      .save()
      .translate(margin + (width - item.formula.w * scale) / 2, y + 38)
      .scale(scale);
    item.formula.draw(0, 0);
    doc.restore();
    doc
      .font("body")
      .fontSize(9.5)
      .fillColor("#334155")
      .text(item.note, margin + 14, y + 38 + item.formula.h * scale + 18, {
        width: width - 28,
      });
    doc.x = margin;
    doc.y = y + height + 12;
  }
}
