# 🎱 Ball Roll

ページのボタンやリンクの上を、物理演算でボールが転がるChrome拡張機能。

## セットアップ

1. `chrome://extensions/` を開く
2. 右上「デベロッパーモード」ON
3. 「パッケージ化されていない拡張機能を読み込む」→ このフォルダを選択

## 使い方

ツールバーの🎱アイコンをクリック → 「ボールを落とす」

| 操作 | 動作 |
|---|---|
| ボールをドラッグ | 掴んで投げる |
| Shift + クリック | その位置に新ボール |
| **F** 押しっぱなし | カーソル周辺を吹き飛ばす |

## 構成

```
manifest.json  popup.html  popup.js  content.js  matter.min.js
```

[matter.js](https://brm.io/matter-js/) で物理演算。Canvas を重ねて描画、`pointer-events: none` でページ操作は邪魔しない。
