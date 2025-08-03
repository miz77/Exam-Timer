// ツールバーのアイコンがクリックされたときに実行
chrome.action.onClicked.addListener((tab) => {
  // 現在のウィンドウでサイドパネルを開く
  chrome.sidePanel.open({ windowId: tab.windowId });
});