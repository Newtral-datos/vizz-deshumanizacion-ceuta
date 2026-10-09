// Gráfico de serie diaria "real frente a esperado" con barras de volumen debajo (Fase 10.3/10.4).
// Uso: serieDiaria("#grafico", { arriba, abajo, color, titulo, subtitulo, medida, contenidos, colores, pie })
// arriba.csv: dia, periodo, n_est, n_est_m, esperado_m, esperado_inf_m, esperado_sup_m
// abajo.csv:  dia, contenido, tweets
// Se dibuja al ancho real del contenedor (sin escalar el SVG), así los textos mantienen su tamaño en móvil.
const GRIS = { oscuro: "#3a3a3a", medio: "#8c8c8c", claro: "#c8c8c8", fondo: "#ececec" };
const CRISIS = "2026-07-30", MUNDIAL = ["2026-06-30", "2026-07-19"];
const fmt = d3.formatLocale({ decimal: ",", thousands: ".", grouping: [3], currency: ["", "€"] }).format(",.0f");
const fecha = d3.utcFormat("%d/%m");
const dia = d3.utcParse("%Y-%m-%d");
const FUENTE = '"Helvetica Neue", Helvetica, Arial, sans-serif';

async function serieDiaria(sel, cfg) {
  // autoType ya convierte las fechas ISO a Date UTC
  const [arr, aba] = await Promise.all([d3.csv(cfg.arriba, d3.autoType), d3.csv(cfg.abajo, d3.autoType)]);
  const { contenidos, colores } = cfg;
  const apilado = d3.rollups(aba, v => v, d => +d.dia).map(([t, v]) => {
    let y = 0;
    const o = { dia: new Date(t), partes: [], total: d3.sum(v, d => d.tweets) };
    contenidos.forEach(c => { const n = v.find(d => d.contenido === c)?.tweets ?? 0; o.partes.push({ c, n, y0: y, y1: y += n }); });
    return o;
  });

  const cont = d3.select(sel).classed("serie", true);
  cont.html(`<h2>${cfg.titulo}</h2><p class="sub">${cfg.subtitulo}</p><div class="lienzo"></div><p class="pie">${cfg.pie}</p>`);
  const lienzo = cont.select(".lienzo");
  let ancho = 0;
  const redibujar = () => {
    const w = Math.round(lienzo.node().clientWidth);
    if (w && w !== ancho) { ancho = w; dibujar(w); }
  };
  new ResizeObserver(redibujar).observe(lienzo.node());
  redibujar();

  function dibujar(W) {
    lienzo.selectAll("*").remove();
    const movil = W < 560, fs = movil ? 12 : 13;
    const hA = movil ? 280 : 400, hB = movil ? 130 : 160, gap = 66;
    const m = { t: 8, r: 10, b: 26, l: movil ? 58 : 66 }, H = m.t + hA + gap + hB + m.b;
    const svg = lienzo.append("svg").attr("width", W).attr("height", H).attr("role", "img").attr("aria-label", cfg.titulo).style("font-family", FUENTE);
    const x0 = dia("2026-06-29"), x1 = dia("2026-08-29");
    const x = d3.scaleUtc([x0, x1], [m.l, W - m.r]);
    const yA = d3.scaleLinear([0, d3.max(arr, d => Math.max(d.n_est, d.esperado_sup_m ?? 0)) * 1.08], [m.t + hA, m.t]);
    const topB = m.t + hA + gap;
    const yB = d3.scaleLinear([0, d3.max(apilado, d => d.total) * 1.05], [topB + hB, topB]);
    const crisis = dia(CRISIS), post = arr.filter(d => d.dia >= crisis);
    const bw = (x(d3.utcDay.offset(x0, 1)) - x(x0)) * 0.8;
    const texto = (g, s, px, py, o = {}) => g.append("text").attr("x", px).attr("y", py).attr("font-size", o.size ?? fs)
      .attr("fill", o.color ?? GRIS.oscuro).attr("text-anchor", o.anchor ?? "start").text(s);

    // fondo: Mundial y línea de la crisis, en los dos paneles
    [[m.t, hA], [topB, hB]].forEach(([y, h]) => {
      svg.append("rect").attr("x", x(dia(MUNDIAL[0]))).attr("width", x(dia(MUNDIAL[1])) - x(dia(MUNDIAL[0])))
        .attr("y", y).attr("height", h).attr("fill", GRIS.fondo).attr("opacity", .7);
      svg.append("line").attr("x1", x(crisis)).attr("x2", x(crisis)).attr("y1", y).attr("y2", y + h)
        .attr("stroke", GRIS.oscuro).attr("stroke-dasharray", "5 4");
    });
    const mx = (x(dia(MUNDIAL[0])) + x(dia(MUNDIAL[1]))) / 2;
    texto(svg, "Mundial", mx, yA(cfg.yMundial ?? yA.domain()[1] * 0.89) + 4, { color: GRIS.medio, anchor: "middle", size: fs + 2 });
    texto(svg, "30 de julio", 0, 0, { anchor: "end" }).attr("transform", `translate(${x(crisis) - 11},${m.t + 40}) rotate(-90)`);
    texto(svg, "Total de publicaciones analizadas cada día:", m.l, topB - 38, { size: fs + 2 });
    lienzo.append("div").attr("class", "leyenda leyenda-panel").style("top", (topB - 28) + "px").style("left", m.l + "px")
      .html(contenidos.map(c => `<span><i style="background:${colores[c]}"></i>${cfg.tooltip?.[c] ?? c}</span>`).join(""));

    // eje x: una marca por semana (cada dos en pantallas estrechas)
    const ticks = d3.utcMonday.every(movil ? 2 : 1).range(x0, x1);
    svg.append("g").attr("transform", `translate(0,${topB + hB})`)
      .call(d3.axisBottom(x).tickValues(ticks).tickFormat(fecha).tickSizeOuter(0))
      .call(g => { g.select(".domain").remove(); g.selectAll("text").attr("fill", GRIS.oscuro).attr("font-size", fs); g.selectAll(".tick line").attr("stroke", GRIS.fondo); });

    // eje y: rejilla con la cifra sobre cada línea
    [[yA, movil ? 4 : 6], [yB, 3]].forEach(([y, n]) => {
      const g = svg.append("g");
      y.ticks(n).forEach(t => {
        g.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "#e4e4e4");
        if (t > 0) texto(g, fmt(t), m.l - 6, y(t) + 4, { anchor: "end" });
      });
    });
    svg.append("text").attr("transform", `translate(14,${(m.t + topB + hB) / 2}) rotate(-90)`).attr("text-anchor", "middle")
      .attr("font-size", fs + 3).attr("fill", GRIS.oscuro).text("Publicaciones por día");

    // tendencia esperada (banda + línea)
    svg.append("path").attr("fill", GRIS.fondo)
      .attr("d", d3.area().x(d => x(d.dia)).y0(d => yA(d.esperado_inf_m)).y1(d => yA(d.esperado_sup_m))(post));
    svg.append("path").attr("fill", "none").attr("stroke", GRIS.oscuro).attr("stroke-dasharray", "5 4")
      .attr("d", d3.line().x(d => x(d.dia)).y(d => yA(d.esperado_m))(post));
    const tx = x(d3.utcDay.round(new Date((+x.invert((m.l + W - m.r) / 2) + +x1) / 2))), te = post.find(d => +d3.utcDay.round(x.invert(tx)) === +d.dia) ?? post.at(-1);
    texto(svg, "Tendencia esperada", tx, yA(te.esperado_m) + fs + 4, { anchor: "middle" });

    // cifra diaria y media (la del periodo previo se prolonga hasta la línea de la crisis)
    svg.append("path").attr("fill", "none").attr("stroke", cfg.color).attr("opacity", .35).attr("stroke-width", 1.5)
      .attr("d", d3.line().x(d => x(d.dia)).y(d => yA(d.n_est))(arr));
    const lm = d3.line().x(d => x(d.dia)).y(d => yA(d.n_est_m));
    const pre = arr.filter(d => d.periodo === "pre");
    pre.push({ ...pre.at(-1), dia: crisis });
    [pre, post].forEach(s => svg.append("path").attr("fill", "none").attr("stroke", cfg.color)
      .attr("stroke-width", 3).attr("stroke-linejoin", "round").attr("d", lm(s)));

    // barras de volumen
    apilado.forEach(d => d.partes.forEach(p => svg.append("rect").attr("x", x(d.dia) - bw / 2).attr("width", bw)
      .attr("y", yB(p.y1)).attr("height", yB(p.y0) - yB(p.y1)).attr("fill", colores[p.c])));

    // interacción: guía vertical, punto en la media, punto en la tendencia esperada y línea oscura entre ambos
    const guia = svg.append("line").attr("y1", m.t).attr("y2", topB + hB).attr("stroke", "#494949").attr("opacity", 0);
    const union = svg.append("line").attr("stroke", GRIS.oscuro).attr("stroke-width", 3).attr("opacity", 0);
    const punto = svg.append("circle").attr("r", 5).attr("fill", "#fff").attr("stroke", cfg.color).attr("stroke-width", 2).attr("opacity", 0);
    const puntoEsp = svg.append("circle").attr("r", 5).attr("fill", "#fff").attr("stroke", GRIS.oscuro).attr("stroke-width", 2).attr("opacity", 0);
    const tip = lienzo.append("div").attr("class", "tip").style("font-size", fs + "px");
    const porDia = new Map(arr.map(d => [+d.dia, d])), vol = new Map(apilado.map(d => [+d.dia, d]));
    const mostrar = ev => {
      const d = porDia.get(+d3.utcDay.round(x.invert(d3.pointer(ev, svg.node())[0])));
      if (!d) return;
      const v = vol.get(+d.dia), px = x(d.dia), esp = d.dia >= crisis;
      guia.attr("x1", px).attr("x2", px).attr("opacity", .8);
      punto.attr("cx", px).attr("cy", yA(d.n_est_m)).attr("opacity", 1);
      union.attr("x1", px).attr("x2", px).attr("y1", yA(d.n_est_m)).attr("y2", yA(d.esperado_m)).attr("opacity", esp ? 1 : 0);
      puntoEsp.attr("cx", px).attr("cy", yA(d.esperado_m)).attr("opacity", esp ? 1 : 0);
      const sub = (color, estilo = "solid") => `text-decoration:underline ${estilo} ${color};text-decoration-thickness:2px;text-underline-offset:3px`;
      const filas = v.partes.filter(p => cfg.tooltip?.[p.c] !== null)
        .map(p => `<i style="background:${colores[p.c]}"></i>${cfg.tooltip?.[p.c] ?? p.c}: ${fmt(p.n)}`);
      tip.html(`<b>${d3.utcFormat("%d/%m/%Y")(d.dia)}</b>` +
        `<br><span style="${sub(cfg.colorDia ?? cfg.color)}">${cfg.medida}</span>: <b>${fmt(d.n_est)}</b>` +
        `<br><span style="${sub(cfg.color)}">Media 3 días</span>: <b>${fmt(d.n_est_m)}</b>` +
        (esp ? `<br><span style="${sub(GRIS.oscuro, "dashed")}">Esperado</span>: <b>${fmt(d.esperado_m)}</b> (${fmt(d.esperado_inf_m)}–${fmt(d.esperado_sup_m)})` : "") +
        `<hr>${filas.join("<br>")}`)
        .style("opacity", 1);
      const tw = tip.node().offsetWidth;   // a la derecha del cursor si cabe; si no, a la izquierda
      tip.style("left", Math.max(0, px + 8 + tw > W ? px - 8 - tw : px + 8) + "px");
    };
    const ocultar = () => { [guia, union, punto, puntoEsp].forEach(e => e.attr("opacity", 0)); tip.style("opacity", 0); };
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", topB + hB - m.t)
      .attr("fill", "none").attr("pointer-events", "all").on("pointermove", mostrar).on("pointerdown", mostrar).on("pointerleave", ocultar);
  }
}
