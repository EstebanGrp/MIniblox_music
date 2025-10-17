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
  return 2000 + index; 
}

async function updateMusic(musicName, customUrl = null) {
  let urlToRedirect;
  const ruleId = getRuleIdForMusic(musicName);

  console.log(`🎵 Intentando actualizar la musica: ${musicName}`);
  console.log(`🆔 Regla del ID: ${ruleId}`);

  try {
    if (customUrl) {

      urlToRedirect = customUrl;
      console.log(`🎯 Usando una url custom: ${urlToRedirect}`);
      

      if (customUrl.includes('docs.google.com') || customUrl.includes('github.com') || customUrl.includes('raw.githubusercontent.com')) {
        console.log(`🔄 Url externa detectada, probando las CORS proxies`);

        const proxies = [
          `https://api.allorigins.win/raw?url=${encodeURIComponent(customUrl)}`,
          `https://corsproxy.io/?${encodeURIComponent(customUrl)}`,
          `https://thingproxy.freeboard.io/fetch/${customUrl}`,
          `https://cors-anywhere.herokuapp.com/${customUrl}`
        ];
        

        let workingProxy = null;
        for (const proxy of proxies) {
          try {
            console.log(`  Testing proxy: ${proxy}`);
            const response = await fetch(proxy, { method: 'HEAD' });
            if (response.ok) {
              console.log(`  ✅ Proxy funcional encontrada: ${proxy}`);
              workingProxy = proxy;
              break;
            } else {
              console.log(`  ❌ Proxy fallida: ${response.status}`);
            }
          } catch (err) {
            console.log(`  ❌ Error de Proxy: ${err.message}`);
          }
        }
        
        if (workingProxy) {
          urlToRedirect = workingProxy;
          console.log(`🎯 Usando proxy funcional: ${urlToRedirect}`);
        } else {
          console.warn(`⚠️ No se encontro una proxy funcional, usa una URL funcional >:v`);
       
        }
      }
      
   
      try {
        const response = await fetch(urlToRedirect, { method: 'HEAD' });
        console.log(`📡 Respuesta de la url custom: ${response.status} ${response.statusText}`);
        if (!response.ok) {
          console.warn(`⚠️ La URL custom te ghosteo como tu ex XD: ${response.status}`);
        }
      } catch (fetchErr) {
        console.warn(`⚠️ No se pudo probar la URL personalizada, como tu el flan porque se lo comio tu primo:`, fetchErr);
      }
    } else {

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

      console.log(`🔍 Probando todas las URL posibles para ${musicName}:`);
      let workingUrl = null;
      
      for (const testUrl of possibleUrls) {
        try {
          console.log(`  Testing: ${testUrl}`);
          const response = await fetch(testUrl, { method: 'HEAD' });
          console.log(`  Response: ${response.status} ${response.statusText}`);
          
          if (response.ok) {
            console.log(`  ✅ ALFIN UNA URL VALIDA: ${testUrl}`);
            workingUrl = testUrl;
            break;
          }
        } catch (fetchErr) {
          console.log(`  ❌ fallo como tu en el amor: ${fetchErr.message}`);
        }
      }
      
      if (workingUrl) {
        urlToRedirect = workingUrl;
        console.log(`🎯 Usando URL valida : ${urlToRedirect}`);
      } else {
        console.error(`❌ No se encontró ninguna URL que funcione para ${musicName}!`);
        throw new Error(`❌ No se encontró una URL de audio válida para ${musicName}`);
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
    
        }
      }]
    });


    try {
      const tabs = await chrome.tabs.query({ url: "https://miniblox.io/*" });
      if (tabs.length > 0) {
        await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {

            if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
              const AudioContextClass = AudioContext || webkitAudioContext;
              const audioContext = new AudioContextClass();
              if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                  console.log('🎵 AudioContext activado para reproducción de música');
                });
              }
            }
          }
        });
      }
    } catch (err) {
      console.log('⚠️ No se pudo activar AudioContext:', err);
    }


    chrome.storage.local.get(["currentMusic"], (data) => {
      const currentMusic = data.currentMusic || {};
      currentMusic[musicName] = urlToRedirect;
      chrome.storage.local.set({ currentMusic });
    });

    console.log(`✅ Cambio de musica creado con exito :D : ${musicName} → ${urlToRedirect}`);
  } catch (err) {
    console.error("❌ Error al poner musica nueva q-q :", err);
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
    return true;
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
        console.log("🎵 Reinicio de música realizado.");
        sendResponse({ ok: true });
      } catch (err) {
        console.error("Error reseteando musica:", err);
        sendResponse({ ok: false });
      }
    });
    return true;
  }
});



