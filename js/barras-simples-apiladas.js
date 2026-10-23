// Una barra apilada por momento, sin leyenda (los colores se explican en título y subtítulo). Reutiliza GRIS, fmt y FUENTE de serie.js.
// Uso: barrasApiladas("#grafico", { datos, momentos, etiquetas, partes: { parte: color }, nombres, textoClaro, yMax, titulo, subtitulo, eje, medida, pie })
// datos.csv: momento, parte, al_dia
async function barrasApiladas(sel, cfg) {
  const datos = await d3.csv(cfg.datos, d3.autoType);
  const { momentos, partes } = cfg, claves = Object.keys(partes);
  const pilas = momentos.map(mo => {
    let y = 0;
    const trozos = claves.map(p => { const n = datos.find(d => d.momento === mo && d.parte === p)?.al_dia ?? 0; return { p, n, y0: y, y1: y += n }; });
    return { mo, trozos, total: y };
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
    const h = movil ? 300 : 400, m = { t: 22, r: 10, b: 46, l: movil ? 58 : 66 }, H = m.t + h + m.b;
    const svg = lienzo.append("svg").attr("width", W).attr("height", H).attr("role", "img").attr("aria-label", cfg.titulo.replace(/<[^>]+>/g, "")).style("font-family", FUENTE);
    const x = d3.scaleBand(momentos, [m.l, W - m.r]).paddingInner(0.55).paddingOuter(0.3);
    const y = d3.scaleLinear([0, cfg.yMax ?? d3.max(pilas, d => d.total) * 1.1], [m.t + h, m.t]);
    const texto = (s, px, py, o = {}) => svg.append("text").attr("x", px).attr("y", py).attr("font-size", o.size ?? fs)
      .attr("fill", o.color ?? GRIS.oscuro).attr("text-anchor", o.anchor ?? "start").attr("font-weight", o.peso ?? null).text(s);

    y.ticks(movil ? 5 : 10).forEach(t => {
      svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "#e4e4e4");
      if (t > 0) texto(fmt(t), m.l - 6, y(t) + 4, { anchor: "end" });
    });
    svg.append("text").attr("transform", `translate(14,${m.t + h / 2}) rotate(-90)`).attr("text-anchor", "middle")
      .attr("font-size", movil ? fs : fs + 2).attr("fill", GRIS.oscuro).text(cfg.eje);
    momentos.forEach(mo => (cfg.etiquetas?.[mo] ?? mo).split("<br>").forEach((linea, k) =>
      texto(linea, x(mo) + x.bandwidth() / 2, m.t + h + 20 + k * (fs + 3), { anchor: "middle" })));

    const sombra = svg.append("rect").attr("y", m.t).attr("height", h).attr("fill", GRIS.fondo).attr("opacity", 0);
    pilas.forEach(p => {
      const cx = x(p.mo) + x.bandwidth() / 2;
      p.trozos.forEach(t => {
        svg.append("rect").attr("x", x(p.mo)).attr("width", x.bandwidth()).attr("y", y(t.y1)).attr("height", y(t.y0) - y(t.y1)).attr("fill", partes[t.p]);
        if (y(t.y0) - y(t.y1) > fs + 6) texto(fmt(t.n), cx, (y(t.y0) + y(t.y1)) / 2 + 4, { anchor: "middle", color: cfg.textoClaro?.includes(t.p) ? "#fff" : GRIS.oscuro, size: fs });
      });
      texto(fmt(p.total), cx, y(p.total) - 6, { anchor: "middle", peso: "bold", size: fs + 2 });
    });

    // interacción: resalta la columna y muestra las cifras del momento
    const tip = lienzo.append("div").attr("class", "tip").style("font-size", fs + "px");
    pilas.forEach(p => {
      const px0 = x(p.mo) - x.step() * 0.275, w = x.step();
      svg.append("rect").attr("x", px0).attr("width", w).attr("y", m.t).attr("height", h).attr("fill", "none").attr("pointer-events", "all")
        .on("pointermove pointerdown", () => {
          sombra.attr("x", px0).attr("width", w).attr("opacity", .5).lower();
          tip.html(`<b>${(cfg.etiquetas?.[p.mo] ?? p.mo).replace("<br>", " ")}</b>${cfg.fechas?.[p.mo] ? `<br>${cfg.fechas[p.mo]}` : ""}<hr>` +
            [...p.trozos].reverse().map(t => `<i style="background:${partes[t.p]}"></i>${cfg.nombres?.[t.p] ?? t.p}: <b>${fmt(t.n)}</b>`).join("<br>") +
            `<hr>${cfg.medida}: <b>${fmt(p.total)}</b>`).style("opacity", 1);
          const cx = x(p.mo) + x.bandwidth() / 2, tw = tip.node().offsetWidth, d = x.bandwidth() / 2 + 8;
          tip.style("left", Math.max(0, cx + d + tw > W ? cx - d - tw : cx + d) + "px").style("top", (m.t + 10) + "px");
        })
        .on("pointerleave", () => { sombra.attr("opacity", 0); tip.style("opacity", 0); });
    });
  }
}
