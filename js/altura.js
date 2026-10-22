// Avisa a la página que incrusta este gráfico (iframe) de la altura que necesita, para que la ajuste.
// Se envía al cargar y cada vez que cambia el contenido (giro del móvil, redimensionado, redibujado del gráfico).
(function () {
  let ultima = 0;
  const enviar = () => {
    const altura = Math.ceil(document.body.getBoundingClientRect().height);
    if (altura && altura !== ultima) {
      ultima = altura;
      parent.postMessage({ tipo: "newtral-altura", pagina: location.pathname.split("/").pop(), altura }, "*");
    }
  };
  new ResizeObserver(enviar).observe(document.body);
  addEventListener("load", enviar);
})();
