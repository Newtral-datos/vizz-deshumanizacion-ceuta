// Líneas por decil con varias series y dos paneles (facetas), escala logarítmica (Fase 12.3).
// Reutiliza GRIS, fmt y FUENTE de serie.js (cargar serie.js antes).
// Uso: decilesFacetas("#grafico", { datos, series: { grupo: color }, facetas: [etapa, ...], valor, titulo, subtitulo, eje, ejeX, pie })
// datos.csv: etapa, grupo, decil_seguidores, <valor>
async function decilesFacetas(sel, cfg) {
  const datos = await d3.csv(cfg.datos, d3.autoType);
  const grupos = Object.keys(cfg.series), v = cfg.valor ?? "media";
  const cont = d3.select(sel).classed("serie", true);
  cont.html(`<h2>${cfg.titulo}</h2><p class="sub">${cfg.subtitulo}</p><div class="leyenda">` +
    grupos.map(g => `<span><i style="background:${cfg.series[g]}"></i>${cfg.nombres?.[g] ?? g}</span>`).join("") +
    `</div><div class="lienzo"></div><p class="pie">${cfg.pie}</p>`);
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
    const movil = W < 560, fs = movil ? 12 : 13, n = cfg.facetas.length;
    const m = { t: 6, r: 10, b: 6, l: movil ? 58 : 66 }, gapV = 56, gapH = 18, hP = movil ? 230 : 380, tit = 22, pie = 40;
    // facetas lado a lado en pantallas anchas, una encima de otra en móvil
    const wP = movil ? W - m.l - m.r : (W - m.l - m.r - gapH * (n - 1)) / n;
    const H = movil ? m.t + n * (tit + hP + pie) + m.b : m.t + tit + hP + pie + m.b;
    const svg = lienzo.append("svg").attr("width", W).attr("height", H).attr("role", "img").attr("aria-label", cfg.titulo.replace(/<[^>]+>/g, "")).style("font-family", FUENTE);
    const todos = datos.map(d => d[v]);
    const y = d3.scaleLog([d3.min(todos) * 0.8, d3.max(todos) * 1.2], [hP, 0]);
    const xd = d3.scalePoint(d3.range(1, 11), [0, wP]).padding(0.4);
    const ticksY = [10, 30, 100, 300, 1000, 3000].filter(t => t >= y.domain()[0] && t <= y.domain()[1]);
    const texto = (g, s, px, py, o = {}) => g.append("text").attr("x", px).attr("y", py).attr("font-size", o.size ?? fs)
      .attr("fill", o.color ?? GRIS.oscuro).attr("text-anchor", o.anchor ?? "start").attr("font-weight", o.peso ?? null).text(s);
    const tip = lienzo.append("div").attr("class", "tip").style("font-size", fs + "px");
    const sub = c => `text-decoration:underline solid ${c};text-decoration-thickness:2px;text-underline-offset:3px`;

    cfg.facetas.forEach((etapa, i) => {
      const ox = movil ? m.l : m.l + i * (wP + gapH), oy = movil ? m.t + i * (tit + hP + pie) : m.t;
      const g = svg.append("g").attr("transform", `translate(${ox},${oy + tit})`);
      texto(svg, etapa, ox, oy + 14, { peso: "bold" });
      ticksY.forEach(t => {
        g.append("line").attr("x1", 0).attr("x2", wP).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "#e4e4e4");
        if (movil || i === 0) texto(g, fmt(t), -6, y(t) + 4, { anchor: "end" });
      });
      xd.domain().forEach(d => texto(g, d, xd(d), hP + 18, { anchor: "middle" }));
      texto(g, cfg.ejeX, wP / 2, hP + 38, { anchor: "middle" });

      const serie = grupos.map(k => datos.filter(d => d.etapa === etapa && d.grupo === k).sort((a, b) => a.decil_seguidores - b.decil_seguidores));
      const linea = d3.line().x(d => xd(d.decil_seguidores)).y(d => y(d[v]));
      // la deshumanización se dibuja la última, para que quede por encima
      grupos.map((k, j) => j).sort((a, b) => (grupos[a] === "Deshumanizan") - (grupos[b] === "Deshumanizan")).forEach(j => {
        g.append("path").attr("fill", "none").attr("stroke", cfg.series[grupos[j]]).attr("stroke-width", 3).attr("stroke-linejoin", "round").attr("d", linea(serie[j]));
        serie[j].forEach(d => g.append("circle").attr("cx", xd(d.decil_seguidores)).attr("cy", y(d[v])).attr("r", 4).attr("fill", "#fff")
          .attr("stroke", cfg.series[grupos[j]]).attr("stroke-width", 2));
      });

      // interacción: guía en el decil más cercano y tooltip con las series de esa faceta
      const guia = g.append("line").attr("y1", 0).attr("y2", hP).attr("stroke", "#494949").attr("opacity", 0);
      const mostrar = ev => {
        const px = d3.pointer(ev, g.node())[0];
        const dec = d3.least(xd.domain(), d => Math.abs(xd(d) - px));
        const filas = grupos.map((k, j) => ({ k, d: serie[j].find(s => s.decil_seguidores === dec) })).filter(f => f.d)
          .sort((a, b) => b.d[v] - a.d[v]);
        guia.attr("x1", xd(dec)).attr("x2", xd(dec)).attr("opacity", .8);
        tip.html(`<b>${etapa}. Decil ${dec}</b>` + filas.map(f => `<br><span style="${sub(cfg.series[f.k])}">${cfg.nombres?.[f.k] ?? f.k}</span>: <b>${fmt(f.d[v])}</b>`).join(""))
          .style("opacity", 1);
        const ax = ox + xd(dec), tw = tip.node().offsetWidth;
        tip.style("left", Math.max(0, ax + 10 + tw > W ? ax - 10 - tw : ax + 10) + "px").style("top", (oy + tit + 10) + "px");
      };
      g.append("rect").attr("width", wP).attr("height", hP).attr("fill", "none").attr("pointer-events", "all")
        .on("pointermove", mostrar).on("pointerdown", mostrar).on("pointerleave", () => { guia.attr("opacity", 0); tip.style("opacity", 0); });
    });
    const alto = movil ? n * (tit + hP + pie) : tit + hP + pie;
    svg.append("text").attr("transform", `translate(14,${m.t + (movil ? alto / 2 : tit + hP / 2)}) rotate(-90)`).attr("text-anchor", "middle")
      .attr("font-size", fs + 3).attr("fill", GRIS.oscuro).text(cfg.eje);
  }
}
