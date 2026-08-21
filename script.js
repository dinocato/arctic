document.getElementById('calculateBtn').addEventListener('click', calculateEmissions);
document.getElementById('domainInput').addEventListener('keypress', function(event) {
  if (event.key === 'Enter') calculateEmissions();
});

function formatCO2(valueInKg) {
  const kg = parseFloat(valueInKg);
  return kg >= 1000 ? `${(kg / 1000).toFixed(2)} t CO₂e` : `${kg.toFixed(2)} kg CO₂e`;
}

function getCarbonRating(gramsPerPageview) {
  if (gramsPerPageview <= 0.040) return { rating: 'A+', label: 'Hervorragend' };
  if (gramsPerPageview <= 0.079) return { rating: 'A',  label: 'Sehr gut' };
  if (gramsPerPageview <= 0.145) return { rating: 'B',  label: 'Gut' };
  if (gramsPerPageview <= 0.209) return { rating: 'C',  label: 'Durchschnittlich' };
  if (gramsPerPageview <= 0.278) return { rating: 'D',  label: 'Unterdurchschnittlich' };
  if (gramsPerPageview <= 0.359) return { rating: 'E',  label: 'Schlecht' };
  return                                { rating: 'F',  label: 'Sehr schlecht' };
}

async function getGridIntensity(zone = "DE") {
  try {
    const response = await fetch(
      `https://api.electricitymap.org/v3/carbon-intensity/latest?zone=${zone}`,
      { headers: { "auth-token": "FSaO4kJqMCz3nFTdF9m6" } }
    );
    if (!response.ok) throw new Error(`Electricity Maps API Fehler: ${response.status}`);
    const data = await response.json();
    console.log("⚡ Electricity Maps:", data);
    return Math.max(data.carbonIntensity, 494);
  } catch (error) {
    console.error("Grid Intensity Fehler:", error);
    return 494;
  }
}

async function calculateEmissions() {
  let domain = document.getElementById('domainInput').value.trim();
  const resultDiv = document.getElementById('result');
  const loadingDiv = document.getElementById('loading');
  const inputRow = document.getElementById('input-row');
  const introText = document.querySelector('.intro-text');

  resultDiv.innerHTML = '';

  if (!domain) {
    resultDiv.innerHTML = "Bitte gib eine Domain ein.";
    return;
  }

  inputRow.style.display = 'none';
  loadingDiv.style.display = 'block';

  domain = domain.replace(/^https?:\/\//, '');

  try {
    const greenRes = await fetch(`https://api.thegreenwebfoundation.org/api/v3/greencheck/${encodeURIComponent(domain)}`);
    const greenData = await greenRes.json();
    const isGreen = greenData.green;
    const hostedBy = greenData.hosted_by || 'Unbekannt';
    const greenHostingFactor = isGreen ? 1 : 0;

    const pageSpeedRes = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://${encodeURIComponent(domain)}&key=AIzaSyAdHcNa5Eu_v57HdibhIADpW99jTtEedwM&category=performance`);
    const pageSpeedData = await pageSpeedRes.json();

    if (!pageSpeedData.lighthouseResult || !pageSpeedData.lighthouseResult.audits['total-byte-weight']) {
      loadingDiv.style.display = 'none';
      inputRow.style.display = 'flex';
      resultDiv.innerHTML = `Fehler: Keine Daten für <strong>${domain}</strong> gefunden.`;
      return;
    }

    const audits = pageSpeedData.lighthouseResult.audits;
    const totalBytes = audits['total-byte-weight'].numericValue;
    const totalGB = totalBytes / (1024 * 1024 * 1024);

    const opDataCenters = 0.055, opNetworks = 0.059, opUserDevices = 0.080;
    const emDataCenters = 0.012, emNetworks = 0.013, emUserDevices = 0.081;
    const gridIntensity = await getGridIntensity("DE");

    const OPDC = totalGB * opDataCenters * gridIntensity * (1 - greenHostingFactor);
    const OPN  = totalGB * opNetworks    * gridIntensity;
    const OPUD = totalGB * opUserDevices * gridIntensity;
    const EMDC = totalGB * emDataCenters * gridIntensity;
    const EMN  = totalGB * emNetworks    * gridIntensity;
    const EMUD = totalGB * emUserDevices * gridIntensity;

    const totalEmissionsPerPageLoad = OPDC + OPN + OPUD + EMDC + EMN + EMUD;

    // Rating 
    const { rating, label } = getCarbonRating(totalEmissionsPerPageLoad);

    const yearlyEmissions = [
      { label: "1.000",   yearlyCO2kg: totalEmissionsPerPageLoad * 1000   * 12 / 1000 },
      { label: "10.000",  yearlyCO2kg: totalEmissionsPerPageLoad * 10000  * 12 / 1000 },
      { label: "100.000", yearlyCO2kg: totalEmissionsPerPageLoad * 100000 * 12 / 1000 }
    ];

    let currentIndex = 1;

    const iceDescriptions = [
      { min: 6.01,  max: 10,   text: "Ruheplatz für ein Walross und Jungtier",   img: "Tiere/Wallross.svg" },
      { min: 3.9,   max: 6,    text: "Schneehöhle für eine Eisbärin",            img: "Tiere/Eisbärin.svg" },
      { min: 3.01,  max: 3.9,  text: "Scholle für ein Walross",                  img: "Tiere/Wallross.svg" },
      { min: 2,     max: 3,    text: "Eisscholle für einen Eisbären",            img: "Tiere/Eisbärin.svg" },
      { min: 1.41,  max: 1.99, text: "Wurfhöhle für eine Saimaa-Ringelrobbe",    img: "Tiere/Robbe.svg" },
      { min: 0.61,  max: 1.4,  text: "Schneewehe für einen Polarfuchs",          img: "Tiere/Polarfuchs.svg" },
      { min: 0.29,  max: 0.60, text: "Eisspalte für einen lauernden Polarfuchs", img: "Tiere/Polarfuchs.svg" },
      { min: 0.12,  max: 0.30, text: "Brutplatz für eine Schnee-Eule",           img: "Tiere/Schneeeule.svg" },
      { min: 0.03,  max: 0.29, text: "Atemloch für eine Saimaa-Ringelrobbe",     img: "Tiere/Ringelrobbe.svg" },
      { min: 0.02,  max: 0.04, text: "Versteck für ein Hermelin",                img: "Tiere/Hermelin.svg" },
      { min: 0.001,  max: 0.02, text: "Trittspur einer Schnee-Eule",              img: "Tiere/Schneeeule.svg" }
    ];

    loadingDiv.style.display = 'none';
    introText.style.display = 'none';

    const hostingStatus = isGreen
      ? `Das Hosting läuft mit Ökostrom. (Hoster: ${hostedBy})`
      : `Das Hosting läuft mit Graustrom. (Hoster: ${hostedBy})`;

    // Alle Rating-Stufen für die Skala
    const allRatings = ['A+', 'A', 'B', 'C', 'D', 'E', 'F'];

    const ratingScale = allRatings.map(r =>
      `<span class="rating-step ${r === rating ? 'rating-active' : ''}">${r}</span>`
    ).join('');

    resultDiv.innerHTML =
      `<h4>Ergebnis für ${domain}</h4>

      <div class="rating-block">
        <div class="rating-badge">${rating}</div>
        <div class="rating-info">
          <div class="rating-label">${label}</div>
          <div class="rating-scale">${ratingScale}</div>
        </div>
      </div>

      <p>${totalEmissionsPerPageLoad.toFixed(2)} g CO₂ entstehen pro Aufruf dieser Webseite.</p>
      <p>${hostingStatus}</p>
      <p>
        Hochgerechnet auf ein Jahr: Bei
        <button id="decreaseBtn">−</button>
        <span id="monthlyViewsLabel">${yearlyEmissions[currentIndex].label}</span>
        <button id="increaseBtn">+</button>
        monatlichen Aufrufen erzeugt ${domain}
        <span id="co2Label">${formatCO2(yearlyEmissions[currentIndex].yearlyCO2kg)}</span>.
        Eisflächenverlust: <span id="iceAreaLabel"></span> m².
      </p>
      <p><span id="iceDescLabel"></span></p>
      <div id="tierBild" class="tier-bild"></div>

      <div class="quellen">
        <span class="quellen-label">Datenquellen</span>
        <a href="https://sustainablewebdesign.org/estimating-digital-emissions/" target="_blank" rel="noopener">Sustainable Web Design Model v4</a>
        <a href="https://www.thegreenwebfoundation.org" target="_blank" rel="noopener">Green Web Foundation</a>
        <a href="https://app.electricitymaps.com/map/live/fifteen_minutes" target="_blank" rel="noopener">Electricity Maps</a>
      </div>`;

    document.getElementById("decreaseBtn").addEventListener("click", () => {
      if (currentIndex > 0) currentIndex--;
      updateCO2Display();
    });

    document.getElementById("increaseBtn").addEventListener("click", () => {
      if (currentIndex < yearlyEmissions.length - 1) currentIndex++;
      updateCO2Display();
    });

    function updateCO2Display() {
      const yearlyCO2 = yearlyEmissions[currentIndex].yearlyCO2kg;
      const iceArea = (yearlyCO2 / 1000) * 3;

      document.getElementById("monthlyViewsLabel").textContent = yearlyEmissions[currentIndex].label;
      document.getElementById("co2Label").textContent = formatCO2(yearlyCO2);
      document.getElementById("iceAreaLabel").textContent = iceArea.toFixed(2);

      const matches = iceDescriptions
        .filter(d => iceArea >= d.min && iceArea <= d.max)
        .sort((a, b) => b.min - a.min);

      if (matches.length > 0) {
        document.getElementById("iceDescLabel").textContent =
          "Genug Platz für: " + matches.map(d => d.text).join(", ");

        const uniqueImgs = [...new Map(matches.map(d => [d.img, d])).values()];
        document.getElementById("tierBild").innerHTML = uniqueImgs
          .map(d => `<img src="${d.img}" alt="${d.text}">`)
          .join('');
      } else {
        document.getElementById("iceDescLabel").textContent = "";
        document.getElementById("tierBild").innerHTML = "";
      }
    }

    updateCO2Display();

  } catch (error) {
    loadingDiv.style.display = 'none';
    inputRow.style.display = 'flex';
    introText.style.display = 'block';
    console.error(error);
    resultDiv.innerHTML = "Fehler bei der Berechnung. Prüfe die Domain oder API Keys.";
  }
}