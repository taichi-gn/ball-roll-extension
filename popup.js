async function inject(action) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // matter.js と content.js をまだ注入してなければ注入
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['matter.min.js', 'content.js'],
  }).catch(() => {}); // 二回目以降の重複注入エラーは握りつぶす

  // コマンド送信
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (cmd) => window.__ballRoll?.(cmd),
    args: [action],
  });
}

document.getElementById('start').onclick = () => inject('drop');
document.getElementById('addMany').onclick = () => inject('dropMany');
document.getElementById('stop').onclick = () => inject('reset');
