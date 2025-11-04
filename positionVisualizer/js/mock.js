// Mock data generator for 4 performers
(function () {
  let timer = null;

  function startMock(onData, intervalMs) {
    stopMock();
    timer = setInterval(() => {
      const values = [0, 0, 0, 0].map(() => Math.random() * 100);
      onData(values);
    }, Math.max(50, intervalMs || 200));
  }

  function stopMock() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  window.MockData = { startMock, stopMock };
})();


