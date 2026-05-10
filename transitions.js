(function () {
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href]');
    if (!a) return;

    const href = a.getAttribute('href');
    if (
      !href ||
      href.startsWith('http') ||
      href.startsWith('mailto') ||
      href.startsWith('#') ||
      a.hasAttribute('download') ||
      a.target === '_blank' ||
      e.ctrlKey || e.metaKey || e.shiftKey || e.altKey
    ) return;

    e.preventDefault();
    document.body.classList.add('page-exit');
    setTimeout(function () {
      window.location.href = href;
    }, 220);
  });
}());
