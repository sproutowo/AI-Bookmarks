// background.js for Manifest V3
chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Smart Bookmarks Extension Installed');
  // Set the side panel to open when the action icon is clicked
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error));
  }
});
