import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, renameSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dbPath = path.join(root, ".storage", "dev-db.json");
const outputDir = path.join(root, "outputs");
const stagingDir = path.join(outputDir, "driver-validation-brief-docx");
const zipPath = path.join(outputDir, "driver-validation-brief.zip");
const docxPath = path.join(outputDir, "driver-validation-brief.docx");

const data = JSON.parse(readFileSync(dbPath, "utf8"));
const targetProtocolIds = data.protocols
  .filter((protocol) => protocol.equipmentType === "auto-refrigerator" && protocol.status === "completed")
  .map((protocol) => protocol.id)
  .sort((a, b) => a - b);

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function minutesCeil(seconds) {
  return Math.ceil(Number(seconds ?? 0) / 60);
}

function minutesFloor(seconds) {
  return Math.floor(Number(seconds ?? 0) / 60);
}

function duration(seconds) {
  const totalMinutes = Math.floor(Number(seconds ?? 0) / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const parts = [];
  if (h) parts.push(`${h} ч`);
  if (m || h) parts.push(`${m} мин`);
  return parts.join(" ") || "0 мин";
}

function normalizeDate(value) {
  if (!value) return "";
  const text = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  return text.replace(/\s*г\.$/, "");
}

function protocolRow(protocolId, index) {
  const protocol = data.protocols.find((item) => item.id === protocolId);
  const gi = data.generalInfo.find((item) => item.protocolId === protocolId);
  const org = data.organizations.find((item) => item.id === protocol.organizationId);
  const exc = data.excursionStudySessions.find((item) => item.protocolId === protocolId);
  const reportDate = normalizeDate(gi.reportDate) || normalizeDate(gi.validationDate);
  const warmup = minutesCeil(exc.t1DurationSec);
  const doorLimit = minutesFloor(exc.t2DurationSec);
  const hold = minutesFloor(exc.t3DurationSec);

  return [
    String(index + 1),
    `${protocol.number}\nдата: ${reportDate}\nPV: ${protocol.pvVerdict === "pass" ? "соответствует" : protocol.pvVerdict}`,
    `${org.name}\nБИН/ИИН: ${org.bin ?? "—"}`,
    `${gi.location}\nХолодильная установка: ${gi.manufacturer} ${gi.model}\nСерийный номер: ${gi.serial || "—"}`,
    `+2...+8 °C\nРасчёт с учётом погрешности датчиков: +2,2...+7,8 °C`,
    `Включить до загрузки не менее чем за ${warmup} мин\n(${duration(exc.t1DurationSec)} по протоколу)`,
    `Разовое открывание дверей: не более ${doorLimit} мин\nВыход за расчётную границу: ${duration(exc.t2DurationSec)}`,
    `При выключении агрегата сохраняет режим не более ${hold} мин\n(${duration(exc.t3DurationSec)} по протоколу)`,
    `Критические датчики: вход ${exc.t1CriticalSensor}; двери ${exc.t2CriticalSensor}; выключение ${exc.t3CriticalSensor}`,
  ];
}

const rows = targetProtocolIds.map(protocolRow);

function textRun(text, bold = false) {
  const chunks = String(text ?? "").split("\n");
  return chunks
    .map((chunk, index) => {
      const br = index === 0 ? "" : "<w:r><w:br/></w:r>";
      return `${br}<w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${esc(chunk)}</w:t></w:r>`;
    })
    .join("");
}

function paragraph(text, opts = {}) {
  const { bold = false, align = "left", spacingAfter = 120, size = 22 } = opts;
  const runs = String(text ?? "")
    .split("\n")
    .map((chunk, index) => {
      const br = index === 0 ? "" : "<w:r><w:br/></w:r>";
      return `${br}<w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${esc(chunk)}</w:t></w:r>`;
    })
    .join("");
  return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:after="${spacingAfter}"/></w:pPr>${runs}</w:p>`;
}

function cell(content, opts = {}) {
  const { width = 1200, shade = "", bold = false } = opts;
  const fill = shade ? `<w:shd w:fill="${shade}"/>` : "";
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${fill}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${textRun(content, bold)}</w:p></w:tc>`;
}

function table(headers, bodyRows, widths) {
  const headerRow = `<w:tr>${headers.map((item, index) => cell(item, { width: widths[index], shade: "D9EAF7", bold: true })).join("")}</w:tr>`;
  const body = bodyRows
    .map((row) => `<w:tr>${row.map((item, index) => cell(item, { width: widths[index] })).join("")}</w:tr>`)
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="8" w:color="8EAADB"/><w:left w:val="single" w:sz="8" w:color="8EAADB"/><w:bottom w:val="single" w:sz="8" w:color="8EAADB"/><w:right w:val="single" w:sz="8" w:color="8EAADB"/><w:insideH w:val="single" w:sz="6" w:color="B7C9D6"/><w:insideV w:val="single" w:sz="6" w:color="B7C9D6"/></w:tblBorders><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>${headerRow}${body}</w:tbl>`;
}

const resultHeaders = [
  "№",
  "Протокол / дата",
  "Организация",
  "Машина / установка",
  "Температурный режим",
  "Когда включить",
  "Открывание дверей",
  "При выключении",
  "Основание",
];
const resultWidths = [360, 1300, 1400, 2100, 1700, 1850, 1850, 1850, 1900];

const signHeaders = ["№", "ФИО водителя", "Машина / маршрут", "Дата ознакомления", "Подпись"];
const signRows = Array.from({ length: 8 }, (_, index) => [String(index + 1), "", "", "", ""]);
const signWidths = [500, 3600, 3600, 2300, 2300];

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraph("Лист ознакомления водителей с результатами валидации авторефрижераторов", { bold: true, align: "center", size: 28 })}
    ${paragraph("Основание: протоколы квалификации/валидации авторефрижераторов ИП \"GxP Logistics\". Данные ниже предназначены для практического применения водителями при подготовке рейса, загрузке, разгрузке и внештатном отключении холодильного агрегата.", { size: 20 })}
    ${table(resultHeaders, rows, resultWidths)}
    ${paragraph("Примечание. Указанные ограничения рассчитаны по результатам испытаний на температурное отклонение. Для режима +2...+8 °C применялась расчётная граница +2,2...+7,8 °C с учётом погрешности датчиков ±0,2 °C. Двери следует открывать только при необходимости и закрывать как можно быстрее.", { size: 18 })}
    ${paragraph("Ознакомлены:", { bold: true, size: 22 })}
    ${table(signHeaders, signRows, signWidths)}
    <w:sectPr>
      <w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>
      <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Лист ознакомления водителей с результатами валидации авторефрижераторов</dc:title>
  <dc:creator>GxP Validation Portal</dc:creator>
  <cp:lastModifiedBy>GxP Validation Portal</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`;

const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>GxP Validation Portal</Application>
</Properties>`;

rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(path.join(stagingDir, "_rels"), { recursive: true });
mkdirSync(path.join(stagingDir, "word"), { recursive: true });
mkdirSync(path.join(stagingDir, "docProps"), { recursive: true });
mkdirSync(outputDir, { recursive: true });

writeFileSync(path.join(stagingDir, "[Content_Types].xml"), contentTypesXml, "utf8");
writeFileSync(path.join(stagingDir, "_rels", ".rels"), relsXml, "utf8");
writeFileSync(path.join(stagingDir, "word", "document.xml"), documentXml, "utf8");
writeFileSync(path.join(stagingDir, "docProps", "core.xml"), coreXml, "utf8");
writeFileSync(path.join(stagingDir, "docProps", "app.xml"), appXml, "utf8");

rmSync(zipPath, { force: true });
rmSync(docxPath, { force: true });
execFileSync("powershell.exe", [
  "-NoProfile",
  "-Command",
  `Set-Location -LiteralPath '${stagingDir.replace(/'/g, "''")}'; Compress-Archive -Path * -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
], { stdio: "inherit" });

if (!existsSync(zipPath)) throw new Error("DOCX zip was not created");
renameSync(zipPath, docxPath);
console.log(docxPath);
