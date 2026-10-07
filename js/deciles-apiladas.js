// Barras apiladas por decil de seguidores con dos paneles (facetas) y eje y lineal compartido (Fase 12.5.2).
// El total de cada decil no se dibuja: aparece en el tooltip. Reutiliza GRIS, fmt y FUENTE de serie.js (cargar serie.js antes).
// Uso: decilesApiladas("#grafico", { datos, partes: { tipo: color }, facetas: [etapa, ...], valor, titulo, subtitulo, eje, ejeX, unidad, pie })
// datos.csv: etapa, decil_seguidores, tipo, <valor> (por defecto "por_mil"), seguidores_desde, seguidores_hasta
async function decilesApiladas(sel, cfg) {
  const datos = await d3.csv(cfg.datos, d3.autoType);
  const partes = Object.keys(cfg.partes), v = cfg.valor ?? "por_mil";
  const dec = d3.formatLocale({ decimal: ",", thousands: ".", grouping: [3] }).format(",.1f");
  const cont = d3.select(sel).classed("serie", true);
  cont.html(`<h2>${cfg.titulo}</h2><p class="sub">${cfg.subtitulo}</p><div class="lienzo"></div>` + (cfg.leyenda === false ? "" : `<div class="leyenda">` +
    partes.map(p => `<span><i style="background:${cfg.partes[p]}"></i>${p}</span>`).join("") + `</div>`) + `<p class="pie">${cfg.pie}</p>`);
  const lienzo = cont.select(".lienzo");

  // una pila por etapa y decil: partes apiladas en el orden de cfg.partes (la primera abajo)
  const pilas = cfg.facetas.map(etapa => d3.range(1, 11).map(decil => {
    const filas = datos.filter(d => d.etapa === etapa && d.decil_seguidores === decil);
    let y = 0;
    const trozos = partes.map(p => { const n = filas.find(d => d.tipo === p)?.[v] ?? 0; return { p, n, y0: y, y1: y += n }; });
    return { etapa, decil, trozos, total: y, desde: filas[0]?.seguidores_desde, hasta: filas[0]?.seguidores_hasta };
  }));
  const maximo = d3.max(pilas.flat(), d => d.total);

  let ancho = 0;
  const redibujar = () => {
    const w = Math.round(lienzo.node().clientWidth);
    if (w && w !== ancho) { ancho = w; dibujar(w); }
  };
  new ResizeObserver(redibujar).observe(lienzo.node());
  redibujar();

  function dibujar(W) {
    lienzo.selectAll("*").remove();
    const movil = W < 560, fs = movil ? 12 : 13, n = cfg.facetas.length;
    const m = { t: 6, r: 10, b: 6, l: movil ? 58 : 66 }, gapH = 18, hP = movil ? 230 : 380, tit = 22, pie = 40;
    // facetas lado a lado en pantallas anchas, una encima de otra en móvil
    const wP = movil ? W - m.l - m.r : (W - m.l - m.r - gapH * (n - 1)) / n;
    const H = movil ? m.t + n * (tit + hP + pie) + m.b : m.t + tit + hP + pie + m.b;
    const svg = lienzo.append("svg").attr("width", W).attr("height", H).attr("role", "img").attr("aria-label", cfg.titulo.replace(/<[^>]+>/g, "")).style("font-family", FUENTE);
    const y = d3.scaleLinear([0, maximo * 1.05], [hP, 0]).nice();
    const x = d3.scaleBand(d3.range(1, 11), [0, wP]).paddingInner(0.2).paddingOuter(0.1);
    const texto = (g, s, px, py, o = {}) => g.append("text").attr("x", px).attr("y", py).attr("font-size", o.size ?? fs)
      .attr("fill", o.color ?? GRIS.oscuro).attr("text-anchor", o.anchor ?? "start").attr("font-weight", o.peso ?? null).text(s);
    const tip = lienzo.append("div").attr("class", "tip").style("font-size", fs + "px");

    cfg.facetas.forEach((etapa, i) => {
      const ox = movil ? m.l : m.l + i * (wP + gapH), oy = movil ? m.t + i * (tit + hP + pie) : m.t;
      const g = svg.append("g").attr("transform", `translate(${ox},${oy + tit})`);
      texto(svg, etapa, ox, oy + 14, { peso: "bold" });
      y.ticks(4).forEach(t => {
        g.append("line").attr("x1", 0).attr("x2", wP).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "#e4e4e4");
        if (movil || i === 0) texto(g, fmt(t), -6, y(t) + 4, { anchor: "end" });
      });
      x.domain().forEach(d => texto(g, d, x(d) + x.bandwidth() / 2, hP + 18, { anchor: "middle" }));
      texto(g, cfg.ejeX, wP / 2, hP + 38, { anchor: "middle" });

      // fondo que resalta el decil bajo el puntero
      const sombra = g.append("rect").attr("y", 0).attr("height", hP).attr("fill", GRIS.fondo).attr("opacity", 0);
      pilas[i].forEach(p => p.trozos.forEach(t => g.append("rect").attr("x", x(p.decil)).attr("width", x.bandwidth())
        .attr("y", y(t.y1)).attr("height", y(t.y0) - y(t.y1)).attr("fill", cfg.partes[t.p]).attr("stroke", "#fff").attr("stroke-width", .8)));

      // interacción: columna completa de cada decil, con el total y el aporte de cada tipo en el tooltip
      pilas[i].forEach(p => {
        const x0 = x(p.decil) - x.step() * x.paddingInner() / 2;
        g.append("rect").attr("x", x0).attr("width", x.step()).attr("y", 0).attr("height", hP).attr("fill", "none").attr("pointer-events", "all")
          .on("pointermove pointerdown", () => {
            sombra.attr("x", x0).attr("width", x.step()).attr("opacity", .5).lower();
            const rango = p.desde != null ? ` (${fmt(p.desde)}–${fmt(p.hasta)} seguidores)` : "";
            tip.html(`<b>${etapa}</b><br><b>Decil ${p.decil}</b>${rango}<br><b>${dec(p.total)}</b> ${cfg.unidad}<hr>` +
              [...p.trozos].reverse().map(t => `<i style="background:${cfg.partes[t.p]}"></i>${t.p}: <b>${dec(t.n)}</b>`).join("<br>")).style("opacity", 1);
            const ax = ox + x(p.decil) + x.bandwidth() / 2, tw = tip.node().offsetWidth;
            tip.style("left", Math.max(0, ax + x.bandwidth() / 2 + 8 + tw > W ? ax - x.bandwidth() / 2 - 8 - tw : ax + x.bandwidth() / 2 + 8) + "px")
              .style("top", (oy + tit + 10) + "px");
          })
          .on("pointerleave", () => { sombra.attr("opacity", 0); tip.style("opacity", 0); });
      });
    });
    const alto = movil ? n * (tit + hP + pie) : tit + hP + pie;
    svg.append("text").attr("transform", `translate(14,${m.t + (movil ? alto / 2 : tit + hP / 2)}) rotate(-90)`).attr("text-anchor", "middle")
      .attr("font-size", fs + 3).attr("fill", GRIS.oscuro).text(cfg.eje);
  }
}
