/* ==========================================================================
   Soroush H. Zargarbashi — site behaviour
   Scroll reveals + the small amount of rendering the data files need.
   Every renderer is a no-op unless its hook element is on the page.
   ========================================================================== */
(function () {
  "use strict";

  var PUBS_URL = "data/publications.json";
  var BLOGS_URL = "data/blogs.json";
  var WORDS_PER_MINUTE = 180; // technical prose reads slower; keep in sync with data/blogs.json

  /* ── helpers ─────────────────────────────────────────────────────────── */

  function $(selector) {
    return document.querySelector(selector);
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function getJSON(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error(url + " → " + res.status);
      return res.json();
    });
  }

  function plainAuthors(authorsHtml) {
    return String(authorsHtml || "").replace(/<[^>]+>/g, "");
  }

  function truncate(text, max) {
    var clean = String(text || "").trim();
    if (clean.length <= max) return clean;
    return clean.slice(0, clean.lastIndexOf(" ", max)).trim() + "…";
  }

  function postHref(post) {
    return "blog-post.html?slug=" + encodeURIComponent(post.slug);
  }

  function pubHref(pub) {
    return "pub.html?id=" + encodeURIComponent(pub.id);
  }

  function venueBadge(pub) {
    var venue = pub.tags && pub.tags[0] ? pub.tags[0] : pub.venueTag;
    return venue ? '<span class="venue-badge">' + esc(venue) + "</span>" : "";
  }

  function renderKeywords(tags) {
    return esc((tags || []).slice(1).join(" · "));
  }

  function postMetaLine(post) {
    var parts = [post.dateDisplay || post.date];
    if (post.readingMinutes) parts.push(post.readingMinutes + " min read");
    return parts.filter(Boolean).map(esc).join(" · ");
  }

  /* ── scroll reveals ──────────────────────────────────────────────────── */

  function initReveals() {
    var targets = document.querySelectorAll(".reveal");
    if (!targets.length) return;

    if (!("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(targets, function (el) { el.classList.add("is-in"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });

    Array.prototype.forEach.call(targets, function (el) { observer.observe(el); });
  }

  /* ── publications ────────────────────────────────────────────────────── */

  // Home: numbered rows for the publications flagged `selected`.
  function renderSelectedWork(host, pubs) {
    var selected = pubs.filter(function (p) { return p.selected; });
    host.innerHTML = selected.map(function (pub, i) {
      return (
        '<a class="work-row" href="' + pubHref(pub) + '">' +
          '<span class="work-num">' + String(i + 1).padStart(2, "0") + "</span>" +
          '<span class="work-title">' + esc(pub.title) + "</span>" +
          '<span class="work-venue">' + esc(pub.venueTag) + "</span>" +
          '<span class="work-arrow" aria-hidden="true">→</span>' +
        "</a>"
      );
    }).join("");
  }

  // Publications page: year-grouped entries with a trimmed abstract.
  function renderPublicationList(host, pubs) {
    var years = pubs.map(function (p) { return p.year; })
      .filter(function (y, i, all) { return all.indexOf(y) === i; })
      .sort(function (a, b) { return b - a; });

    host.innerHTML = years.map(function (year) {
      var items = pubs.filter(function (p) { return p.year === year; }).map(function (pub) {
        var writeUp = pub.postSlug
          ? '<a class="link-accent" href="blog-post.html?slug=' + encodeURIComponent(pub.postSlug) + '">Read the write-up →</a>'
          : "";
        var links = [
          pub.links && pub.links.paper ? '<a class="link-underline" href="' + esc(pub.links.paper) + '" target="_blank" rel="noopener">Paper ↗</a>' : "",
          pub.links && pub.links.poster ? '<a class="link-underline" href="' + esc(pub.links.poster) + '" target="_blank" rel="noopener">Poster ↗</a>' : "",
          pub.links && pub.links.talk ? '<a class="link-underline" href="' + esc(pub.links.talk) + '" target="_blank" rel="noopener">Talk ↗</a>' : "",
          '<a class="link-underline" href="' + pubHref(pub) + '">Abstract →</a>',
          writeUp
        ].filter(Boolean).join("");

        return (
          '<article class="pub-item">' +
            '<div class="pub-heading">' +
              '<a href="' + pubHref(pub) + '"><h3 class="pub-title">' + esc(pub.title) + "</h3></a>" +
              venueBadge(pub) +
            "</div>" +
            '<p class="pub-authors">' + pub.authorsHtml + "</p>" +
            '<p class="pub-abstract">' + esc(truncate(pub.abstract, 320)) + "</p>" +
            '<div class="pub-meta">' + renderKeywords(pub.tags) + "</div>" +
            '<div class="pub-links">' + links + "</div>" +
          "</article>"
        );
      }).join("");

      return (
        '<div class="pub-group">' +
          '<div class="pub-year">' + esc(year) + "</div>" +
          items +
        "</div>"
      );
    }).join("");
  }

  // CV: one compact line per selected publication.
  function renderCvPublications(host, pubs) {
    var selected = pubs.filter(function (p) { return p.selected; });
    host.innerHTML = selected.map(function (pub) {
      return (
        '<div class="cv-row">' +
          '<div class="cv-date">' + esc(pub.year) + " · " + esc(pub.venueTag) + "</div>" +
          '<div class="cv-body">' + esc(pub.title) + ' <span class="cv-note">· ' + esc(plainAuthors(pub.authorsHtml)) + "</span></div>" +
          '<div class="cv-meta"><a class="link-accent" href="' + pubHref(pub) + '">Read →</a></div>' +
        "</div>"
      );
    }).join("");

    var countEl = $("[data-pub-count]");
    if (countEl) countEl.textContent = "Full bibliography — " + pubs.length + " papers →";
  }

  // Publication detail page.
  function renderPublicationDetail(host, pubs) {
    var id = new URLSearchParams(location.search).get("id");
    var pub = pubs.filter(function (p) { return p.id === id; })[0];

    if (!pub) {
      host.innerHTML = '<h1 class="detail-title">Publication not found.</h1>' +
        '<p class="page-intro">It may have moved — see the <a class="link-accent" href="publications.html">full list</a>.</p>';
      return;
    }

    document.title = pub.title + " — Soroush H. Zargarbashi";

    var resource = function (url, label) {
      return url
        ? '<a class="link-underline" href="' + esc(url) + '" target="_blank" rel="noopener">' + label + " ↗</a>"
        : '<span class="is-disabled">' + label + "</span>";
    };
    var links = pub.links || {};

    host.innerHTML =
      '<div class="detail-heading">' +
        venueBadge(pub) +
        '<h1 class="detail-title">' + esc(pub.title) + "</h1>" +
      "</div>" +
      '<p class="detail-authors">' + pub.authorsHtml + "</p>" +
      '<p class="detail-venue">' + pub.venue + "</p>" +
      '<div class="resource-links">' +
        resource(links.paper, "Paper") +
        resource(links.poster, "Poster") +
        resource(links.talk, "Talk") +
        (pub.postSlug ? '<a class="link-underline" href="blog-post.html?slug=' + encodeURIComponent(pub.postSlug) + '">Write-up →</a>' : "") +
      "</div>" +
      '<div class="detail-section-label">Abstract</div>' +
      '<div class="prose" id="pub-abstract"><p>' + esc(pub.abstract) + "</p></div>" +
      '<div class="detail-section-label mt-32">Topics</div>' +
      '<div class="keyword-list">' + renderKeywords(pub.tags) + "</div>";

    typesetMath($("#pub-abstract"));
  }

  /* ── writing ─────────────────────────────────────────────────────────── */

  // Home: teaser for the most recent post.
  function renderLatestPost(host, posts) {
    var post = posts[0];
    if (!post) { host.innerHTML = ""; return; }

    host.innerHTML =
      '<a class="teaser" href="' + postHref(post) + '">' +
        "<div>" +
          '<div class="tl-date">' + postMetaLine(post) + "</div>" +
          '<h3 class="teaser-title">' + esc(post.title) + "</h3>" +
          '<p class="teaser-dek">' + esc(post.description) + "</p>" +
        "</div>" +
        '<div class="teaser-cta">Read the post <span aria-hidden="true">→</span></div>' +
      "</a>";
  }

  // Writing page: the full archive.
  function renderPostList(host, posts) {
    if (!posts.length) {
      host.innerHTML = '<p class="page-intro">No posts yet.</p>';
      return;
    }
    host.innerHTML = posts.map(function (post) {
      return (
        '<a class="post-row" href="' + postHref(post) + '">' +
          '<div class="post-row-date">' +
            (post.category ? '<span class="post-row-kind">' + esc(post.category) + "</span>" : "") +
            postMetaLine(post) +
          "</div>" +
          "<div>" +
            '<h2 class="post-row-title">' + esc(post.title) + "</h2>" +
            '<p class="post-row-dek">' + esc(post.description) + "</p>" +
          "</div>" +
        "</a>"
      );
    }).join("");
  }

  /* ── markdown post rendering ─────────────────────────────────────────── */

  function parseFrontmatter(text) {
    var match = text.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) return { data: {}, content: text };

    var data = {};
    match[1].split("\n").forEach(function (line) {
      var colon = line.indexOf(":");
      if (colon === -1) return;
      data[line.slice(0, colon).trim()] = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
    });
    return { data: data, content: match[2] };
  }

  function readingMinutes(text) {
    return Math.max(1, Math.round(text.trim().split(/\s+/).length / WORDS_PER_MINUTE));
  }

  function typesetMath(el) {
    if (!el || typeof window.renderMathInElement !== "function") return;
    window.renderMathInElement(el, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false }
      ],
      throwOnError: false
    });
  }

  function renderPost(host) {
    var slug = new URLSearchParams(location.search).get("slug") || "";
    if (!/^[a-z0-9-]+$/i.test(slug)) {
      showPostError(host);
      return;
    }

    fetch("blogs/" + slug + ".md")
      .then(function (res) {
        if (!res.ok) throw new Error("not found");
        return res.text();
      })
      .then(function (text) {
        var parsed = parseFrontmatter(text);
        var data = parsed.data;
        var meta = [data.dateDisplay || data.date, readingMinutes(parsed.content) + " min read"];

        if (data.tags) {
          meta.push(data.tags.replace(/^\[|\]$/g, "").split(",")[0].trim());
        }

        document.title = (data.title || "Writing") + " — Soroush H. Zargarbashi";
        $("[data-post-meta]").textContent = meta.filter(Boolean).join(" · ");
        $("[data-post-title]").textContent = data.title || "";
        host.innerHTML = window.marked ? window.marked.parse(parsed.content) : esc(parsed.content);
        typesetMath(host);
        loadPlots(host);
      })
      .catch(function () { showPostError(host); });
  }

  // Posts can embed live plots with <canvas data-plot="name">.
  function loadPlots(host) {
    if (!host.querySelector("[data-plot]")) return;
    var script = document.createElement("script");
    script.src = "assets/asd-plots/plots.js?v=20261030-3";
    document.body.appendChild(script);
  }

  function showPostError(host) {
    $("[data-post-title]").textContent = "Post not found.";
    host.innerHTML = '<p>The post you are looking for is not here. See <a href="blog.html">all writing</a>.</p>';
  }

  /* ── boot ────────────────────────────────────────────────────────────── */

  function fail(where) {
    return function (err) { console.error("[site] " + where, err); };
  }

  initReveals();

  var selectedWork = $("[data-selected-work]");
  var pubList = $("[data-publication-list]");
  var cvPubs = $("[data-cv-publications]");
  var pubDetail = $("[data-publication-detail]");

  if (selectedWork || pubList || cvPubs || pubDetail) {
    getJSON(PUBS_URL).then(function (pubs) {
      if (selectedWork) renderSelectedWork(selectedWork, pubs);
      if (pubList) renderPublicationList(pubList, pubs);
      if (cvPubs) renderCvPublications(cvPubs, pubs);
      if (pubDetail) renderPublicationDetail(pubDetail, pubs);
    }).catch(fail("publications"));
  }

  var latestPost = $("[data-latest-post]");
  var postList = $("[data-post-list]");

  if (latestPost || postList) {
    getJSON(BLOGS_URL).then(function (data) {
      var posts = (data.posts || []).slice().sort(function (a, b) {
        return String(b.date).localeCompare(String(a.date));
      });
      if (latestPost) renderLatestPost(latestPost, posts);
      if (postList) renderPostList(postList, posts);
    }).catch(fail("blogs"));
  }

  var postBody = $("[data-post-body]");
  if (postBody) renderPost(postBody);
})();
