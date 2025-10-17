const MUSIC = [
  "blank","earth","eclipse","firefly","hellcat","high",
  "invincible","lets_go","linked","my_heart","nekozilla",
  "popsicle","seven","skyhigh"
];

document.addEventListener("DOMContentLoaded", () => {
  const musicSelect = document.getElementById("musicSelect");
  const customUrl = document.getElementById("customUrl");
  const applyBtn = document.getElementById("applyMusicBtn");
  const status = document.getElementById("status");


  MUSIC.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name.charAt(0).toUpperCase() + name.slice(1);
    musicSelect.appendChild(option);
  });

  applyBtn.addEventListener("click", () => {
    const selected = musicSelect.value;
    const custom = customUrl.value.trim();

    console.log("🎵 Apply button clicked");
    console.log("Selected music:", selected);
    console.log("Custom URL:", custom);

  
    if (!selected && !custom) {
      console.log("🔄 Resetting music");
      chrome.runtime.sendMessage({ type: "resetMusic" }, (response) => {
        console.log("Reset response:", response);
        status.textContent = "🎵 Music reset successfully.";
      });
      return;
    }


    if (!selected) {
      alert("Select a track first");
      return;
    }


    console.log("📤 Sending message to background script");
    chrome.runtime.sendMessage({ type: "setMusic", musicName: selected, customUrl: custom || null }, (response) => {
      console.log("Background response:", response);
      if (response && response.ok) {
        status.textContent = "✅Música aplicada exitosamente.";
      } else {
        status.textContent = "❌ Error al aplicar la música. Revisa la consola.";
      }
    });
  });
});






