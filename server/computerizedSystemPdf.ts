import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const M = 52;

export async function generateComputerizedSystemPdf(input: { protocol: any; org: any; config: any }): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: M, bufferPages: true, info: { Title: `GAMP-отчёт ${input.protocol.number}`, Author: input.org.name } });
  doc.registerFont("body", path.join(__dirname, "fonts", "DejaVuSans.ttf"));
  doc.registerFont("bold", path.join(__dirname, "fonts", "DejaVuSans-Bold.ttf"));
  doc.font("body");
  const chunks: Buffer[] = [];
  doc.on("data", c => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const c = input.config || {};
  doc.font("bold").fontSize(11).fillColor("#64748b").text(input.org.name.toUpperCase(), { align: "center" });
  doc.moveDown(5).fontSize(12).text("ОТЧЁТ О ВАЛИДАЦИИ", { align: "center" });
  doc.moveDown(.4).fontSize(23).fillColor("#0f172a").text("КОМПЬЮТЕРИЗИРОВАННОЙ СИСТЕМЫ", { align: "center" });
  doc.moveDown(1).font("body").fontSize(11).fillColor("#64748b").text("Риск-ориентированный жизненный цикл по принципам GAMP 5", { align: "center" });
  doc.moveDown(3);
  kv([["Номер документа", input.protocol.number],["Система", c.systemName || "—"],["Версия", c.version || "—"],["Поставщик", c.supplier || "—"],["Предполагаемое использование", c.intendedUse || "—"],["Уровень GxP-риска", c.riskLevel || "—"]]);
  section("1. Паспорт и границы системы");
  kv([["Владелец процесса",c.processOwner||"—"],["Владелец системы",c.systemOwner||"—"],["Размещение",c.hosting||"—"],["Среда",c.environment||"—"],["Тип решения",c.solutionType||"—"],["Интерфейсы",c.interfaces||"—"],["Категории данных",c.dataTypes||"—"]]);
  section("2. GxP-скрининг и оценка риска");
  const screeningLabels:any={productQuality:"Влияние на качество продукции",patientSafety:"Влияние на безопасность пациента",gxpRecords:"Создание/изменение GxP-записей",releaseDecision:"Использование при выпуске",calculations:"Критичные расчёты",electronicSignatures:"Электронные подписи",editableRecords:"Изменение электронных записей",integrations:"GxP-интерфейсы"};
  kv(Object.entries(screeningLabels).map(([k,v])=>[String(v),c.screening?.[k]?"Да":"Нет"]));
  section("3. Требования пользователя (URS)");
  table(["ID","Требование","Критичность"],(c.requirements||[]).map((r:any)=>[r.id,r.text,r.criticality]),[75,330,85]);
  section("4. Оценка поставщика и средств контроля");
  const sa=c.supplierAssessment||{}; kv([["Договор / SLA",yes(sa.sla)],["Документация",yes(sa.documentation)],["Уведомление об изменениях",yes(sa.changeNotification)],["Управление инцидентами",yes(sa.incidentManagement)],["Резервное копирование",yes(sa.backup)],["Информационная безопасность",yes(sa.security)],["Вывод",sa.notes||"—"]]);
  section("5. Матрица прослеживаемости и результаты тестирования");
  table(["Тест","URS","Результат"],(c.tests||[]).map((t:any)=>[t.id,t.requirementId,t.result==="pass"?"Пройден":t.result==="fail"?"Не пройден":"Не выполнен"]),[100,230,160]);
  for(const t of c.tests||[]){sub(`${t.id} / ${t.requirementId||"без связи"}`);kv([["Шаги",t.steps||"—"],["Ожидаемый результат",t.expected||"—"],["Фактический результат",t.actual||"—"]]);}
  section("6. Отклонения и решение о выпуске");
  const decision:any={approved:"Разрешить эксплуатацию",conditional:"Разрешить с ограничениями",rejected:"Не разрешать эксплуатацию",pending:"Решение не принято"};
  kv([["Отклонения",c.deviations||"Отсутствуют"],["Решение",decision[c.releaseDecision]||"—"],["Ограничения",c.releaseRestrictions||"—"],["Периодический обзор",`${c.periodicReviewMonths||12} мес.`]]);
  doc.addPage(); section("7. Заключение");
  const allCritical=(c.requirements||[]).filter((r:any)=>r.criticality==="high"); const passed=new Set((c.tests||[]).filter((t:any)=>t.result==="pass").map((t:any)=>t.requirementId));
  const traceable=allCritical.every((r:any)=>passed.has(r.id));
  doc.font("body").fontSize(11).fillColor("#0f172a").text(traceable&&c.releaseDecision==="approved"?"Критичные требования прослежены до успешно выполненных тестов. Система признана пригодной для заявленного использования.":"До выпуска необходимо закрыть непройденные проверки, обеспечить прослеживаемость критичных требований и документировать итоговое решение.",{lineGap:4});
  const range=doc.bufferedPageRange(); for(let i=range.start;i<range.start+range.count;i++){doc.switchToPage(i);doc.font("body").fontSize(8).fillColor("#64748b").text(`${input.protocol.number}  •  Стр. ${i+1} из ${range.count}`,M,doc.page.height-36,{width:doc.page.width-M*2,align:"center",lineBreak:false});}
  doc.end(); return done;

  function yes(v:any){return v?"Да":"Нет"} function ensure(h=60){if(doc.y+h>doc.page.height-60)doc.addPage()}
  function section(t:string){ensure(80);doc.moveDown(1).font("bold").fontSize(15).fillColor("#0f172a").text(t);doc.moveDown(.7)}
  function sub(t:string){ensure(55);doc.moveDown(.6).font("bold").fontSize(11).fillColor("#334155").text(t);doc.moveDown(.3)}
  function kv(rows:any[]){for(const [k,v] of rows){doc.font("body").fontSize(9);const h=Math.max(25,doc.heightOfString(String(v),{width:300})+12);ensure(h);const y=doc.y;doc.rect(M,y,490,h).fillAndStroke("#f8fafc","#e2e8f0");doc.fillColor("#64748b").text(String(k),M+8,y+7,{width:155});doc.font("bold").fillColor("#0f172a").text(String(v),M+170,y+7,{width:310});doc.y=y+h;}doc.moveDown(.5)}
  function table(headers:string[],rows:any[][],widths:number[]){ensure(35);let y=doc.y;let x=M;for(let i=0;i<headers.length;i++){doc.rect(x,y,widths[i],26).fillAndStroke("#0f172a","#e2e8f0");doc.font("bold").fontSize(8).fillColor("white").text(headers[i],x+5,y+8,{width:widths[i]-10});x+=widths[i]}doc.y=y+26;for(const row of rows.length?rows:[["—","Нет данных","—"]]){doc.font("body").fontSize(8);const h=Math.max(27,...row.map((v,i)=>doc.heightOfString(String(v||"—"),{width:widths[i]-10})+10));ensure(h);y=doc.y;x=M;for(let i=0;i<row.length;i++){doc.rect(x,y,widths[i],h).stroke("#e2e8f0");doc.fillColor("#0f172a").text(String(row[i]||"—"),x+5,y+5,{width:widths[i]-10});x+=widths[i]}doc.y=y+h;}doc.moveDown(.5)}
}
