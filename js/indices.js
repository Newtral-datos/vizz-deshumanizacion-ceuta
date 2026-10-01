// Series diarias en índice (media previa a la crisis = 100), varias líneas, sin panel de volumen (Fase 10.5).
// Reutiliza GRIS, fmt, dia, fecha, CRISIS, MUNDIAL y FUENTE de serie.js (cargar serie.js antes).
// Uso: indicesDiarios("#grafico", { datos, series: { nombre: color }, coloresDia, titulo, subtitulo, eje, pie })
// datos.csv: dia, periodo, serie, valor, media
async function indicesDiarios(sel, cfg) {
  const datos = await d3.csv(cfg.datos, d3.autoType);
  const nombres = Object.keys(cfg.series);
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
    const hA = movil ? 330 : 440, m = { t: 8, r: 10, b: 26, l: movil ? 58 : 66 }, H = m.t + hA + m.b;
    const svg = lienzo.append("svg").attr("width", W).attr("height", H).attr("role", "img").attr("aria-label", cfg.titulo.replace(/<[^>]+>/g, "")).style("font-family", FUENTE);
    const x0 = dia("2026-06-29"), x1 = dia("2026-08-29"), crisis = dia(CRISIS);
    const x = d3.scaleUtc([x0, x1], [m.l, W - m.r]);
    const y = d3.scaleLinear([0, d3.max(datos, d => d.valor) * 1.08], [m.t + hA, m.t]);
    const texto = (g, s, px, py, o = {}) => g.append("text").attr("x", px).attr("y", py).attr("font-size", o.size ?? fs)
      .attr("fill", o.color ?? GRIS.oscuro).attr("text-anchor", o.anchor ?? "start").text(s);

    // fondo: Mundial y línea de la crisis
    const mx0 = x(dia(MUNDIAL[0])), mx1 = x(dia(MUNDIAL[1]));
    svg.append("rect").attr("x", mx0).attr("width", mx1 - mx0).attr("y", m.t).attr("height", hA).attr("fill", GRIS.fondo).attr("opacity", .7);
    svg.append("line").attr("x1", x(crisis)).attr("x2", x(crisis)).attr("y1", m.t).attr("y2", m.t + hA).attr("stroke", GRIS.oscuro).attr("stroke-dasharray", "5 4");
    texto(svg, "Mundial", (mx0 + mx1) / 2, y(cfg.yMundial ?? y.domain()[1] * 0.93) + 4, { color: GRIS.medio, anchor: "middle", size: fs + 2 });
    texto(svg, "Crisis de Ceuta", 0, 0, { anchor: "end" }).attr("transform", `translate(${x(crisis) - 11},${m.t + 40}) rotate(-90)`);

    // ejes
    svg.append("g").attr("transform", `translate(0,${m.t + hA})`)
      .call(d3.axisBottom(x).tickValues(d3.utcMonday.every(movil ? 2 : 1).range(x0, x1)).tickFormat(fecha).tickSizeOuter(0))
      .call(g => { g.select(".domain").remove(); g.selectAll("text").attr("fill", GRIS.oscuro).attr("font-size", fs); g.selectAll(".tick line").attr("stroke", GRIS.fondo); });
    y.ticks(movil ? 5 : 6).forEach(t => {
      svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "#e4e4e4");
      if (t > 0) texto(svg, fmt(t), m.l - 6, y(t) + 4, { anchor: "end" });
    });
    svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(100)).attr("y2", y(100)).attr("stroke", GRIS.medio);   // base = 100
    svg.append("text").attr("transform", `translate(14,${m.t + hA / 2}) rotate(-90)`).attr("text-anchor", "middle")
      .attr("font-size", fs + 3).attr("fill", GRIS.oscuro).text(cfg.eje);

    // líneas: cifra diaria clara y media (la del periodo previo se prolonga hasta la línea de la crisis)
    const porSerie = new Map(nombres.map(n => [n, datos.filter(d => d.serie === n).sort((a, b) => a.dia - b.dia)]));
    const lDia = d3.line().x(d => x(d.dia)).y(d => y(d.valor)), lMed = d3.line().x(d => x(d.dia)).y(d => y(d.media));
    nombres.forEach(n => {
      const s = porSerie.get(n), pre = s.filter(d => d.periodo === "pre"), post = s.filter(d => d.periodo === "post");
      pre.push({ ...pre.at(-1), dia: crisis });
      svg.append("path").attr("fill", "none").attr("stroke", cfg.series[n]).attr("opacity", .35).attr("stroke-width", 1.5).attr("d", lDia(s));
      [pre, post].forEach(t => svg.append("path").attr("fill", "none").attr("stroke", cfg.series[n]).attr("stroke-width", 3).attr("stroke-linejoin", "round").attr("d", lMed(t)));
      if (cfg.etiquetasLinea === false) return;
      const u = s.at(-1);   // etiqueta directa al final de cada línea, en lugar de leyenda
      texto(svg, n, x(u.dia), y(u.media) + (u.media >= d3.mean(nombres.filter(k => k !== n).map(k => porSerie.get(k).at(-1).media)) ? -18 : 28), { anchor: "end" });
    });

    // interacción
    const guia = svg.append("line").attr("y1", m.t).attr("y2", m.t + hA).attr("stroke", "#494949").attr("opacity", 0);
    const puntos = nombres.map(n => svg.append("circle").attr("r", 5).attr("fill", "#fff").attr("stroke", cfg.series[n]).attr("stroke-width", 2).attr("opacity", 0));
    const tip = lienzo.append("div").attr("class", "tip").style("font-size", fs + "px");
    const sub = c => `text-decoration:underline solid ${c};text-decoration-thickness:2px;text-underline-offset:3px`;
    const mostrar = ev => {
      const t = +d3.utcDay.round(x.invert(d3.pointer(ev, svg.node())[0]));
      const filas = nombres.map(n => porSerie.get(n).find(d => +d.dia === t));
      if (filas.some(d => !d)) return;
      const px = x(filas[0].dia);
      guia.attr("x1", px).attr("x2", px).attr("opacity", .8);
      puntos.forEach((p, i) => p.attr("cx", px).attr("cy", y(filas[i].media)).attr("opacity", 1));
      tip.html(`<b>${d3.utcFormat("%d/%m/%Y")(filas[0].dia)}</b>` + filas.map((d, i) =>
        `<br><span style="${sub(cfg.series[nombres[i]])}">${nombres[i]}</span>: <b>${fmt(d.valor)}</b><br>&nbsp;&nbsp;Media 3 días: <b>${fmt(d.media)}</b>`).join("<hr>"))
        .style("opacity", 1);
      const tw = tip.node().offsetWidth;
      tip.style("left", Math.max(0, px + 8 + tw > W ? px - 8 - tw : px + 8) + "px");
    };
    const ocultar = () => { guia.attr("opacity", 0); puntos.forEach(p => p.attr("opacity", 0)); tip.style("opacity", 0); };
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", hA)
      .attr("fill", "none").attr("pointer-events", "all").on("pointermove", mostrar).on("pointerdown", mostrar).on("pointerleave", ocultar);
  }
}
