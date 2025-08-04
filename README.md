## Exam Timer

[![Chromeウェブストアのロゴ](https://developer.chrome.com/static/docs/webstore/branding/image/mPGKYBIR2uCP0ApchDXE.png)](https://chromewebstore.google.com/detail/adpjpmojjfagbkjljkideecomfelpoio?utm_source=item-share-cb)

Exam Timer は、試験の開始時刻に合わせてタイマーを設定できるアナログ時計です。視覚的な残り時間や経過時間の感覚を再現し、練習する機会を提供します。

ユーザーはこのツールを利用することで、模擬試験の環境をより本番環境に近づけることが期待できます。




---

## 目次

1. [機能概要](#機能概要)  
2. [対応ブラウザ](#対応ブラウザ)   
3. [Chromeウェブストアからインストール](#chromeウェブストアからインストール)
4. [ビルド済みzipからインストール](#ビルド済みzipからインストール)  
5. [ソースからビルドしてインストール](#ソースからビルドしてインストール)  

---

## 機能概要

- アナログ時計をサイドパネルへ表示。
- 時計をマウスで直接ドラッグして、時刻を直感的に操作することが可能。
- 開始時刻と終了時刻を設定し、試験開始ボタンを押すと、タイマーが動作。
- 多言語表示に対応 ( 日本語 / English) 

---


## 対応ブラウザ（

- Chromium ベースのブラウザ（  
　Chrome 138  
　Edge 138  
　Vivaldi 7.5  
　）で動作確認済み  

---

## Chromeウェブストアからインストール

1. Chrome ウェブストアへアクセス

[![Chromeウェブストアのロゴ](https://developer.chrome.com/static/docs/webstore/branding/image/tbyBjqi7Zu733AAKA5n4.png)](https://chromewebstore.google.com/detail/adpjpmojjfagbkjljkideecomfelpoio?utm_source=item-share-cb)



2. 「Chrome に追加」ボタンをクリック


## ビルド済みzipからインストール
1. [Releases ページ](https://github.com/miz77/Exam-Timer/releases)のzipファイルを解凍する。
2. ブラウザからchrome://extensions/ を開き、デベロッパーモードを有効する。
3. 「パッケージ化されていない拡張機能を読み込む」をクリックして、解凍済みフォルダを選択する。


## ソースからビルドしてインストール

```bash
# リポジトリをクローン
git clone https://github.com/miz77/Exam-Timer.git
cd Exam-Timer

# 依存インストール
npm install
# or
yarn install

# ビルド
npm run build
# or
yarn build
```

chrome://extensions/ からデベロッパーモードを有効にした上で、ビルド済みフォルダ (dist/) を読み込んでご利用ください。


---
## 謝辞 (Acknowledgements)
　この拡張機能は、Google Gemini 2.5 Pro から多大なご支援を受けて開発されました。また、私が所属する化学科のある先生が、ご自身で VSCode 拡張機能を公開している姿に刺激を受けて開発したものでもあります。さらに、色覚異常を持つ友人の存在は、カラーユニバーサルデザインを学び、このツールの開発へ取り入れるきっかけとなりました。この場を借りて感謝申し上げます。

## 参考

- 「カラー（概要）｜デジタル庁デザインシステムβ版」（デジタル庁）（[https://design.digital.go.jp/foundations/color/](https://design.digital.go.jp/foundations/color/)）
- [Tailwind CLI の公式ドキュメント](https://tailwindcss.com/docs/installation/tailwind-cli)