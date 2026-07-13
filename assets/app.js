const STORAGE_KEY = "directorio_valle_sagrado_v2";

    const DAYS = [
      { key: "lun", label: "Lunes" },
      { key: "mar", label: "Martes" },
      { key: "mie", label: "Miércoles" },
      { key: "jue", label: "Jueves" },
      { key: "vie", label: "Viernes" },
      { key: "sab", label: "Sábado" },
      { key: "dom", label: "Domingo" },
    ];

    const CATEGORIES = {
      retiro_0_20: { label: "espacios de retiro (de 0 a 20 pers)", color: "#d94841" },
      retiro_20_40: { label: "espacios de retiro (de 20 a 40 pers)", color: "#2f9e44" },
      retiro_40_60: { label: "espacios de retiro (de 40 a 60 pers)", color: "#1971c2" },
      eventos_holisticos: { label: "espacios en alquiler para eventos holisticos", color: "#7048e8" },
      restaurantes: { label: "restaurantes", color: "#f76707" },
      panaderia_autor: { label: "panaderia de autor", color: "#0b7285" },
      ropa_conceptual: { label: "ropa conceptual", color: "#ae3ec9" },
      medico: { label: "medico", color: "#e03131" },
      canchas_tennis: { label: "canchas de tennis", color: "#5c940d" },
      piscinas: { label: "piscinas", color: "#1c7ed6" },
      lavanderias: { label: "lavanderias", color: "#15aabf" },
      mudanzas: { label: "mudanzas", color: "#495057" },
      clases_adultos: { label: "clases interactivas adultos", color: "#c2255c" },
      clases_ninos: { label: "clases interactivas ninos", color: "#2b8a3e" },
      apotecary: { label: "apothecary", color: "#364fc7" },
      arquitectura_inmobiliaria: { label: "arquitectura e inmobiliaria", color: "#087f5b" },
      otro: { label: "otro", color: "#6741d9" },
    };

    const SACRED_VALLEY_BOUNDS = L.latLngBounds([
      [-13.62, -72.45],
      [-13.14, -71.75],
    ]);

    const map = L.map("map", {
      maxBounds: SACRED_VALLEY_BOUNDS,
      maxBoundsViscosity: 0.9,
      minZoom: 10,
      maxZoom: 18,
      zoomControl: true,
    }).setView([-13.315, -72.084], 11);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const drawer = document.getElementById("drawer");
    const drawerTitle = document.getElementById("drawerTitle");
    const infoView = document.getElementById("infoView");
    const addView = document.getElementById("addView");

    const searchInput = document.getElementById("searchInput");
    const filterCategory = document.getElementById("filterCategory");
    const categorySelect = document.getElementById("category");
    const legendList = document.getElementById("legendList");
    const legend = document.querySelector(".legend");
    const btnToggleLegend = document.getElementById("btnToggleLegend");
    const statusEl = document.getElementById("status");
    const itemsList = document.getElementById("itemsList");
    const hoursGrid = document.getElementById("hoursGrid");

    let places = loadPlaces();
    let markers = [];
    let pendingMarker = null;

    const fields = {
      placeName: document.getElementById("placeName"),
      category: document.getElementById("category"),
      contactName: document.getElementById("contactName"),
      whatsapp: document.getElementById("whatsapp"),
      address: document.getElementById("address"),
      description: document.getElementById("description"),
      lat: document.getElementById("lat"),
      lng: document.getElementById("lng"),
    };

    function buildHoursGrid() {
      hoursGrid.innerHTML = DAYS.map((d) => `
        <div class="day-row" data-day="${d.key}">
          <label class="day-check"><input type="checkbox" data-role="enabled" /> ${d.label}</label>
          <input type="time" data-role="open" disabled />
          <input type="time" data-role="close" disabled />
        </div>
      `).join("");

      hoursGrid.querySelectorAll(".day-row").forEach((row) => {
        const enabled = row.querySelector('[data-role="enabled"]');
        const open = row.querySelector('[data-role="open"]');
        const close = row.querySelector('[data-role="close"]');
        enabled.addEventListener("change", () => {
          const active = enabled.checked;
          open.disabled = !active;
          close.disabled = !active;
          if (!active) {
            open.value = "";
            close.value = "";
          }
        });
      });
    }

    function populateCategoryControls() {
      const options = Object.entries(CATEGORIES)
        .map(([key, value]) => `<option value="${key}">${sanitize(value.label)}</option>`)
        .join("");
      filterCategory.innerHTML = `<option value="all">Todas</option>${options}`;
      categorySelect.innerHTML = options;
    }

    function renderLegend() {
      legendList.innerHTML = Object.values(CATEGORIES)
        .map((category) => `<div class="legend-item"><span class="dot" style="background:${category.color}"></span> ${sanitize(category.label)}</div>`)
        .join("");
    }

    function collectHours() {
      const out = {};
      hoursGrid.querySelectorAll(".day-row").forEach((row) => {
        const day = row.dataset.day;
        const enabled = row.querySelector('[data-role="enabled"]').checked;
        if (!enabled) return;
        const open = row.querySelector('[data-role="open"]').value;
        const close = row.querySelector('[data-role="close"]').value;
        if (open && close) out[day] = { open, close };
      });
      return out;
    }

    function hoursToText(hours) {
      if (!hours || typeof hours !== "object") return "No indicado";
      const parts = [];
      for (const d of DAYS) {
        const h = hours[d.key];
        if (!h) continue;
        parts.push(`${d.label}: ${h.open}-${h.close}`);
      }
      return parts.length ? parts.join(" · ") : "No indicado";
    }

    function resetHoursGrid() {
      hoursGrid.querySelectorAll(".day-row").forEach((row) => {
        row.querySelector('[data-role="enabled"]').checked = false;
        const open = row.querySelector('[data-role="open"]');
        const close = row.querySelector('[data-role="close"]');
        open.value = "";
        close.value = "";
        open.disabled = true;
        close.disabled = true;
      });
    }

    function loadPlaces() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_e) {
        return [];
      }
    }

    function savePlaces() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
    }

    function showStatus(message, isError = true) {
      statusEl.style.color = isError ? "#9d7f1f" : "#6f5a1a";
      statusEl.textContent = message;
      setTimeout(() => {
        if (statusEl.textContent === message) statusEl.textContent = "";
      }, 3600);
    }

    function sanitize(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function normalizeWhatsapp(raw) {
      const digits = String(raw || "").replace(/[^\d+]/g, "");
      return digits ? (digits.startsWith("+") ? digits : `+${digits}`) : "";
    }

    function whatsappLink(phone) {
      const clean = normalizeWhatsapp(phone).replace("+", "");
      return clean ? `https://wa.me/${clean}` : "";
    }

    function ensureDrawerOpen(view) {
      drawer.classList.add("open");
      drawer.setAttribute("aria-hidden", "false");
      if (view === "add") {
        infoView.classList.remove("active");
        addView.classList.add("active");
        drawerTitle.textContent = "Yellow Page Sacred Valley";
      } else {
        addView.classList.remove("active");
        infoView.classList.add("active");
        drawerTitle.textContent = "Yellow Page Sacred Valley";
      }
    }

    function closeDrawer() {
      drawer.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
    }

    function toggleLegend() {
      legend.classList.toggle("open");
      btnToggleLegend.textContent = legend.classList.contains("open") ? "ocultar leyenda" : "ver leyenda";
    }

    function makeDropIcon(color) {
      return L.divIcon({
        className: "",
        html: `<span class="map-pin-drop" style="--pin-color:${color}"></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
        popupAnchor: [0, -18],
      });
    }

    async function reverseGeocode(lat, lng) {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) return null;
        const data = await res.json();
        const address = String(data.display_name || "").trim();
        const name = String(
          data.name
            || data.address?.amenity
            || data.address?.tourism
            || data.address?.shop
            || data.address?.building
            || data.address?.road
            || ""
        ).trim();
        return {
          name: name || null,
          address: address || null,
        };
      } catch (_e) {
        return null;
      }
    }

    function createMarker(place) {
      const category = CATEGORIES[place.category] || CATEGORIES.otro;
      const marker = L.marker([place.lat, place.lng], {
        icon: makeDropIcon(category.color),
      }).addTo(map);

      const wa = place.whatsapp
        ? `<a class="wh-link" href="${whatsappLink(place.whatsapp)}" target="_blank" rel="noopener">WhatsApp: ${sanitize(place.whatsapp)}</a>`
        : "Sin WhatsApp";

      marker.bindPopup(
        `<p class="popup-name">${sanitize(place.placeName)}</p>
         <p class="popup-line"><strong>${sanitize(category.label)}</strong></p>
         <p class="popup-line">${sanitize(place.address || "Sin dirección")}</p>
         <p class="popup-line">Horario: ${sanitize(hoursToText(place.hours))}</p>
         <p class="popup-line">${wa}</p>
         <p class="popup-line">${sanitize(place.description || "")}</p>
         <p class="popup-line">Publicado por: ${sanitize(place.contactName || "Anónimo")}</p>`
      );

      return marker;
    }

    function clearMarkers() {
      markers.forEach((m) => map.removeLayer(m));
      markers = [];
    }

    function filteredPlaces() {
      const q = searchInput.value.trim().toLowerCase();
      const cat = filterCategory.value;
      return places.filter((p) => {
        const byCategory = cat === "all" || p.category === cat;
        const haystack = `${p.placeName} ${p.address} ${p.description} ${hoursToText(p.hours)} ${p.contactName}`.toLowerCase();
        const byQuery = !q || haystack.includes(q);
        return byCategory && byQuery;
      });
    }

    function render() {
      clearMarkers();
      const list = filteredPlaces();

      list.forEach((place) => markers.push(createMarker(place)));

      itemsList.innerHTML = list.length
        ? list.map((p) => {
            const cat = CATEGORIES[p.category] || CATEGORIES.otro;
            const wa = p.whatsapp
              ? `<a class="wh-link" href="${whatsappLink(p.whatsapp)}" target="_blank" rel="noopener">${sanitize(p.whatsapp)}</a>`
              : "Sin WhatsApp";
            return `<article class="item">
              <h4>${sanitize(p.placeName)}</h4>
              <p class="meta">${sanitize(cat.label)} · ${sanitize(p.address || "sin dirección")}</p>
              <p class="meta">Horario: ${sanitize(hoursToText(p.hours))}</p>
              <p class="meta">WhatsApp: ${wa}</p>
            </article>`;
          }).join("")
        : '<p class="meta">No hay resultados con ese filtro.</p>';
    }

    function validatePlace(place) {
      if (!place.placeName || place.placeName.length < 2) return "Ingresa un nombre válido del lugar.";
      if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return "Selecciona una ubicación válida en el mapa.";
      if (!SACRED_VALLEY_BOUNDS.contains([place.lat, place.lng])) return "El marcador debe estar dentro del Valle Sagrado del Perú.";
      if (place.whatsapp && !/^\+?\d{8,15}$/.test(place.whatsapp.replace(/\s+/g, ""))) return "El WhatsApp parece inválido.";
      if (!place.hours || Object.keys(place.hours).length === 0) return "Selecciona al menos un día con horario de apertura.";
      return "";
    }

    function readPlaceFromForm() {
      return {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        placeName: fields.placeName.value.trim(),
        category: fields.category.value,
        contactName: fields.contactName.value.trim(),
        whatsapp: fields.whatsapp.value.trim(),
        hours: collectHours(),
        address: fields.address.value.trim(),
        description: fields.description.value.trim(),
        lat: Number(fields.lat.value),
        lng: Number(fields.lng.value),
        createdAt: new Date().toISOString(),
      };
    }

    function resetForm() {
      fields.placeName.value = "";
      fields.contactName.value = "";
      fields.whatsapp.value = "";
      fields.address.value = "";
      fields.description.value = "";
      fields.lat.value = "";
      fields.lng.value = "";
      resetHoursGrid();
      if (pendingMarker) {
        map.removeLayer(pendingMarker);
        pendingMarker = null;
      }
    }

    map.on("click", async (evt) => {
      const lat = evt.latlng.lat.toFixed(6);
      const lng = evt.latlng.lng.toFixed(6);
      fields.lat.value = lat;
      fields.lng.value = lng;

      if (pendingMarker) map.removeLayer(pendingMarker);
      pendingMarker = L.marker([Number(lat), Number(lng)], {
        icon: makeDropIcon("#1f2a1f"),
      }).addTo(map);

      const fallbackName = `Lugar ${lat}, ${lng}`;
      const fallbackAddress = `Punto seleccionado en mapa (${lat}, ${lng})`;
      fields.placeName.value = fallbackName;
      fields.address.value = fallbackAddress;

      const reverse = await reverseGeocode(lat, lng);
      if (reverse?.name) fields.placeName.value = reverse.name;
      if (reverse?.address) fields.address.value = reverse.address;

      ensureDrawerOpen("add");
      showStatus("Ubicación fijada con nombre y dirección autocompletados.", false);
    });

    document.getElementById("btnOpenInfo").addEventListener("click", () => ensureDrawerOpen("info"));
    document.getElementById("btnOpenAdd").addEventListener("click", () => ensureDrawerOpen("add"));
    document.getElementById("btnCloseDrawer").addEventListener("click", closeDrawer);
    btnToggleLegend.addEventListener("click", toggleLegend);

    document.getElementById("btnGeocode").addEventListener("click", async () => {
      const query = fields.address.value.trim();
      if (!query) {
        showStatus("Escribe una dirección o referencia primero.");
        return;
      }
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pe&q=${encodeURIComponent(query + " Valle Sagrado Cusco")}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const data = await res.json();
        if (!Array.isArray(data) || !data[0]) {
          showStatus("No encontré esa dirección. Prueba con un distrito (Pisac, Urubamba, etc.).");
          return;
        }
        const lat = Number(data[0].lat);
        const lng = Number(data[0].lon);
        fields.lat.value = lat.toFixed(6);
        fields.lng.value = lng.toFixed(6);
        map.flyTo([lat, lng], 14, { duration: 0.8 });
        if (pendingMarker) map.removeLayer(pendingMarker);
        pendingMarker = L.marker([lat, lng], {
          icon: makeDropIcon("#1f2a1f"),
        }).addTo(map);
        ensureDrawerOpen("add");
        showStatus("Dirección ubicada y marcador temporal colocado.", false);
      } catch (_e) {
        showStatus("No se pudo geolocalizar ahora. Intenta de nuevo.");
      }
    });

    document.getElementById("btnAdd").addEventListener("click", () => {
      const place = readPlaceFromForm();
      const err = validatePlace(place);
      if (err) {
        showStatus(err, true);
        return;
      }
      place.whatsapp = normalizeWhatsapp(place.whatsapp);
      places.unshift(place);
      savePlaces();
      render();
      resetForm();
      showStatus("Marcador agregado correctamente al directorio.", false);
      ensureDrawerOpen("info");
    });

    document.getElementById("btnExport").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(places, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "directorio_valle_sagrado.json";
      a.click();
      URL.revokeObjectURL(url);
      showStatus("Exportación completada.", false);
    });

    document.getElementById("btnImport").addEventListener("click", () => {
      document.getElementById("jsonFile").click();
    });

    document.getElementById("jsonFile").addEventListener("change", async (evt) => {
      const file = evt.target.files && evt.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const incoming = JSON.parse(text);
        if (!Array.isArray(incoming)) {
          showStatus("El archivo JSON no es válido.");
          return;
        }
        const valid = incoming
          .map((entry) => ({
            id: entry.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`),
            placeName: String(entry.placeName || "").trim(),
            category: CATEGORIES[entry.category] ? entry.category : "otro",
            contactName: String(entry.contactName || "").trim(),
            whatsapp: String(entry.whatsapp || "").trim(),
            hours: (entry.hours && typeof entry.hours === "object") ? entry.hours : {},
            address: String(entry.address || "").trim(),
            description: String(entry.description || "").trim(),
            lat: Number(entry.lat),
            lng: Number(entry.lng),
            createdAt: entry.createdAt || new Date().toISOString(),
          }))
          .filter((entry) => !validatePlace(entry));

        if (!valid.length) {
          showStatus("No encontré registros válidos para importar.");
          return;
        }

        places = [...valid, ...places];
        savePlaces();
        render();
        showStatus(`Importación correcta: ${valid.length} lugares agregados.`, false);
      } catch (_e) {
        showStatus("No se pudo importar el archivo JSON.");
      } finally {
        evt.target.value = "";
      }
    });

    searchInput.addEventListener("input", render);
    filterCategory.addEventListener("change", render);

    populateCategoryControls();
    renderLegend();
    buildHoursGrid();
    render();
