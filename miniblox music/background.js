chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ currentMusic: {} });
});

function getRuleIdForMusic(musicName) {
  const MUSIC = [
    "blank", "earth", "eclipse", "firefly", "hellcat", "high", "invincible",
    "lets_go", "linked", "my_heart", "nekozilla", "popsicle", "seven", "skyhigh"
  ];

  const index = MUSIC.indexOf(musicName);
  if (index === -1) {
    throw new Error(`Unknown music name: ${musicName}`);
  }
  return 2000 + index; // IDs distintos a las skins (1000+)
}

async function updateMusic(musicName, customUrl = null) {
  let urlToRedirect;
  const ruleId = getRuleIdForMusic(musicName);

  console.log(`🎵 Attempting to update music: ${musicName}`);
  console.log(`🆔 Rule ID: ${ruleId}`);

  try {
    if (customUrl) {
      // Usar URL personalizada
      urlToRedirect = customUrl;
      console.log(`🎯 Using custom URL: ${urlToRedirect}`);
      
      // Usar proxy CORS para URLs externas
      if (customUrl.includes('docs.google.com') || customUrl.includes('github.com') || customUrl.includes('raw.githubusercontent.com')) {
        console.log(`🔄 External URL detected, testing CORS proxies`);
        // Probar múltiples proxies
        const proxies = [
          `https://api.allorigins.win/raw?url=${encodeURIComponent(customUrl)}`,
          `https://corsproxy.io/?${encodeURIComponent(customUrl)}`,
          `https://thingproxy.freeboard.io/fetch/${customUrl}`,
          `https://cors-anywhere.herokuapp.com/${customUrl}`
        ];
        
        // Probar cada proxy hasta encontrar uno que funcione
        let workingProxy = null;
        for (const proxy of proxies) {
          try {
            console.log(`  Testing proxy: ${proxy}`);
            const response = await fetch(proxy, { method: 'HEAD' });
            if (response.ok) {
              console.log(`  ✅ Working proxy found: ${proxy}`);
              workingProxy = proxy;
              break;
            } else {
              console.log(`  ❌ Proxy failed: ${response.status}`);
            }
          } catch (err) {
            console.log(`  ❌ Proxy error: ${err.message}`);
          }
        }
        
        if (workingProxy) {
          urlToRedirect = workingProxy;
          console.log(`🎯 Using working proxy: ${urlToRedirect}`);
        } else {
          console.warn(`⚠️ No working proxy found, using original URL`);
          // Usar la URL original como último recurso
        }
      }
      
      // Verificar que la URL personalizada sea accesible
      try {
        const response = await fetch(urlToRedirect, { method: 'HEAD' });
        console.log(`📡 Custom URL response: ${response.status} ${response.statusText}`);
        if (!response.ok) {
          console.warn(`⚠️ Custom URL not accessible: ${response.status}`);
        }
      } catch (fetchErr) {
        console.warn(`⚠️ Could not test custom URL:`, fetchErr);
      }
    } else {
      // Probar diferentes formatos de URL posibles para Miniblox
      const possibleUrls = [
        `https://miniblox.io/audio/music/${musicName}.webm`,
        `https://miniblox.io/audio/music/${musicName}.mp3`,
        `https://miniblox.io/audio/music/${musicName}.ogg`,
        `https://miniblox.io/audio/${musicName}.webm`,
        `https://miniblox.io/audio/${musicName}.mp3`,
        `https://miniblox.io/music/${musicName}.webm`,
        `https://miniblox.io/music/${musicName}.mp3`,
        `https://miniblox.io/sounds/${musicName}.webm`,
        `https://miniblox.io/sounds/${musicName}.mp3`
      ];

      console.log(`🔍 Testing all possible URLs for ${musicName}:`);
      let workingUrl = null;
      
      for (const testUrl of possibleUrls) {
        try {
          console.log(`  Testing: ${testUrl}`);
          const response = await fetch(testUrl, { method: 'HEAD' });
          console.log(`  Response: ${response.status} ${response.statusText}`);
          
          if (response.ok) {
            console.log(`  ✅ Found working URL: ${testUrl}`);
            workingUrl = testUrl;
            break;
          }
        } catch (fetchErr) {
          console.log(`  ❌ Failed: ${fetchErr.message}`);
        }
      }
      
      if (workingUrl) {
        urlToRedirect = workingUrl;
        console.log(`🎯 Using working URL: ${urlToRedirect}`);
      } else {
        console.error(`❌ No working URL found for ${musicName}!`);
        throw new Error(`No valid audio URL found for ${musicName}`);
      }
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [ruleId],
      addRules: [{
        id: ruleId,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { url: urlToRedirect }
        },
        condition: {
          urlFilter: `https://miniblox.io/*/${musicName}.*`,
          resourceTypes: ["media", "xmlhttprequest"]
          // Algunos motores de juego cargan el audio como XHR
        }
      }]
    });

    // Intentar activar el AudioContext en la página de Miniblox
    try {
      const tabs = await chrome.tabs.query({ url: "https://miniblox.io/*" });
      if (tabs.length > 0) {
        await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            // Crear y activar AudioContext para permitir reproducción
            if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
              const AudioContextClass = AudioContext || webkitAudioContext;
              const audioContext = new AudioContextClass();
              if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                  console.log('🎵 AudioContext activated for music playback');
                });
              }
            }
          }
        });
      }
    } catch (err) {
      console.log('⚠️ Could not activate AudioContext:', err);
    }

    // Guardar cambios
    chrome.storage.local.get(["currentMusic"], (data) => {
      const currentMusic = data.currentMusic || {};
      currentMusic[musicName] = urlToRedirect;
      chrome.storage.local.set({ currentMusic });
    });

    console.log(`✅ Music rule created successfully: ${musicName} → ${urlToRedirect}`);
  } catch (err) {
    console.error("❌ Error updating music:", err);
    throw err;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "setMusic") {
    updateMusic(message.musicName, message.customUrl)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error(err);
        sendResponse({ ok: false });
      });
    return true; // mantener el canal abierto
  }

  if (message.type === "resetMusic") {
    chrome.storage.local.get(["currentMusic"], async (data) => {
      const currentMusic = data.currentMusic || {};
      const ruleIds = Object.keys(currentMusic).map(name => getRuleIdForMusic(name));

      try {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIds
        });

        chrome.storage.local.set({ currentMusic: {} });
        console.log("🎵 Music reset done.");
        sendResponse({ ok: true });
      } catch (err) {
        console.error("Error resetting music:", err);
        sendResponse({ ok: false });
      }
    });
    return true;
  }
});



