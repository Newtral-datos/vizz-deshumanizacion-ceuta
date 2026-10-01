// Barras por momento: arriba una barra simple y abajo barras apiladas, con eje y propio y las etiquetas
// de x en el hueco entre los dos paneles (Fase 10.1). Reutiliza GRIS, fmt y FUENTE de serie.js.
// Uso: barrasNivel("#grafico", { arriba, abajo, color, momentos, contenidos, colores, titulo, subtitulo, ejeArriba, ejeAbajo, medida, pie })
// arriba.csv: momento, al_dia   abajo.csv: momento, contenido, al_dia
async function barrasNivel(sel, cfg) {
  const [arr, aba] = await Promise.all([d3.csv(cfg.arriba, d3.autoType), d3.csv(cfg.abajo, d3.autoType)]);
  const { momentos, contenidos, colores } = cfg;
  const valor = new Map(arr.map(d => [d.momento, d.al_dia]));
  const pilas = momentos.map(mo => {
    let y = 0;
    const partes = contenidos.map(c => { const n = aba.find(d => d.momento === mo && d.contenido === c)?.al_dia ?? 0; return { c, n, y0: y, y1: y += n }; });
    return { mo, partes, total: y };
  });

  const cont = d3.select(sel).classed("serie", true);
  cont.html(`<h2>${cfg.titulo}</h2><p class="sub">${cfg.subtitulo}</p><div class="lienzo"></div><div class="leyenda">` +
    contenidos.map(c => `<span><i style="background:${colores[c]}"></i>${c}</span>`).join("") + `</div><p class="pie">${cfg.pie}</p>`);
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
    // el panel de abajo es más alto que en la versión de R, sin llegar a repartirse 50/50
    const hA = movil ? 230 : 320, hB = movil ? 170 : 210, gap = 56, m = { t: 22, r: 10, b: 8, l: movil ? 58 : 66 };
    const topB = m.t + hA + gap, H = topB + hB + m.b;
    const svg = lienzo.append("svg").attr("width", W).attr("height", H).attr("role", "img").attr("aria-label", cfg.titulo.replace(/<[^>]+>/g, "")).style("font-family", FUENTE);
    const x = d3.scaleBand(momentos, [m.l, W - m.r]).paddingInner(0.55).paddingOuter(0.3);
    const yA = d3.scaleLinear([0, d3.max(arr, d => d.al_dia) * 1.12], [m.t + hA, m.t]);
    const yB = d3.scaleLinear([0, d3.max(pilas, d => d.total) * 1.12], [topB + hB, topB]);
    const texto = (s, px, py, o = {}) => svg.append("text").attr("x", px).attr("y", py).attr("font-size", o.size ?? fs)
      .attr("fill", o.color ?? GRIS.oscuro).attr("text-anchor", o.anchor ?? "start").attr("font-weight", o.peso ?? null).text(s);

    // rejilla y cifras de cada eje y (el de abajo es propio)
    [[yA, 4], [yB, 3]].forEach(([y, n]) => y.ticks(n).forEach(t => {
      svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "#e4e4e4");
      texto(fmt(t), m.l - 6, y(t) + 4, { anchor: "end" });
    }));
    const rot = (s, cy, size) => svg.append("text").attr("transform", `translate(14,${cy}) rotate(-90)`).attr("text-anchor", "middle")
      .attr("font-size", size).attr("fill", GRIS.oscuro).text(s);
    rot(cfg.ejeArriba, m.t + hA / 2, movil ? fs : fs + 2);
    rot(cfg.ejeAbajo, topB + hB / 2, movil ? fs : fs + 2);

    // etiquetas de x a medio camino entre los dos paneles
    momentos.forEach(mo => texto(cfg.etiquetas?.[mo] ?? mo, x(mo) + x.bandwidth() / 2, m.t + hA + gap / 2 + 4, { anchor: "middle" }));

    // barra superior y barras apiladas
    momentos.forEach((mo, i) => {
      const cx = x(mo) + x.bandwidth() / 2, v = valor.get(mo);
      svg.append("rect").attr("x", x(mo)).attr("width", x.bandwidth()).attr("y", yA(v)).attr("height", yA(0) - yA(v)).attr("fill", cfg.color);
      texto(fmt(v), cx, yA(v) - 6, { anchor: "middle", peso: "bold", size: fs + 2 });
      pilas[i].partes.forEach(p => svg.append("rect").attr("x", x(mo)).attr("width", x.bandwidth()).attr("y", yB(p.y1)).attr("height", yB(p.y0) - yB(p.y1)).attr("fill", colores[p.c]));
      texto(fmt(pilas[i].total), cx, yB(pilas[i].total) - 5, { anchor: "middle" });
    });

    // interacción: resalta la columna y muestra las cifras del momento
    const tip = lienzo.append("div").attr("class", "tip").style("font-size", fs + "px");
    const sombra = svg.append("rect").attr("y", m.t).attr("height", topB + hB - m.t).attr("fill", GRIS.fondo).attr("opacity", 0).lower();
    momentos.forEach((mo, i) => {
      const px0 = x(mo) - x.step() * 0.275, ancho = x.step();
      svg.append("rect").attr("x", px0).attr("width", ancho).attr("y", m.t).attr("height", topB + hB - m.t).attr("fill", "none").attr("pointer-events", "all")
        .on("pointermove pointerdown", () => {
          sombra.attr("x", px0).attr("width", ancho).attr("opacity", .5);
          tip.html(`<b>${cfg.etiquetas?.[mo] ?? mo}</b><br><span style="text-decoration:underline solid ${cfg.color};text-decoration-thickness:2px;text-underline-offset:3px">${cfg.medida}</span>: <b>${fmt(valor.get(mo))}</b>` +
            `<hr>${pilas[i].partes.map(p => `<i style="background:${colores[p.c]}"></i>${cfg.tooltip?.[p.c] ?? p.c}: ${fmt(p.n)}`).join("<br>")}` +
            `<br>Total: <b>${fmt(pilas[i].total)}</b>`).style("opacity", 1);
          const cx = x(mo) + x.bandwidth() / 2, tw = tip.node().offsetWidth;
          tip.style("left", Math.max(0, cx + x.bandwidth() / 2 + 8 + tw > W ? cx - x.bandwidth() / 2 - 8 - tw : cx + x.bandwidth() / 2 + 8) + "px").style("top", (m.t + 10) + "px");
        })
        .on("pointerleave", () => { sombra.attr("opacity", 0); tip.style("opacity", 0); });
    });
  }
}
