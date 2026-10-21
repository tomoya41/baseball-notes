# Pixelのホーム画面版

2026-10-21。Chromeから公開Web版をホーム画面へ追加できるよう、manifestと192/512px PNGを追加。アイコンはユーザーの変更指示に基づき画像生成で制作した独自BNモノグラム。ホームベースの余白と上向きのアクセントで野球・分析を表す。通常用と余白を持つmaskable用を分離。第三者の写真・球団ロゴ・新しい外部依存はない。追加費用¥0。

制作は組み込みimagegenを使用。制作指示：`Baseball Notesの野球データ分析を表す独自BNモノグラム。濃紺・アイボリー・ミントの3色。中央にホームベースの負形、力強い文字組み。小サイズで識別可能。第三者ロゴ・写真・ボール線画・細かな文字なし。` 保存先は `public/icons/baseball-notes-{192,512}.png` と `baseball-notes-maskable-512.png`。旧ネイティブAPKの署名・保存領域は変更しない。

`id` / `scope` は公開ディレクトリ相対、起動先は同じ範囲の `#/NPB/home`。GitHub Pagesのサブパスと既存Hash Routerを保つ。アプリ・データの公開は既存preserve-only手順を使い、DBへの接続や保護payload変更を行わない。

ChromeのメニューからのインストールはService Workerなしでも対応する。[Chrome公式](https://developer.chrome.com/blog/update-install-criteria)に従い、インストールだけを目的とした空のfetch handlerは追加しない。通常のオンライン起動・再読み込みで公開版を使う。閉じたままの即時更新、Push、完全なオフラインcold startは保証しない。既存の検証済みresponse cacheを維持する。

既存USB導入版 `com.tomoya41.baseballnotes` はそのまま残す。Chromeのホーム画面版は別の保存領域で、ネイティブ版のFavorites / Collections / Watchは自動移行しない。データ削除や無断アンインストールは不要。WebAPKの生成が利用できない場合、Chromeはショートカットへfallbackすることがある。実際の導入方式と動作はPixelで確認する。

手動の場合：PixelのChromeで[公開版](https://tomoya41.github.io/baseball-notes/#/NPB/home)を開く → ︙ →「ホーム画面に追加」→「インストール」。ホームから起動し、アドレスバーなしの画面、ホーム/試合/選手/記録/My、戻る操作を確認する。TalkBackや通信断の確認は別の実機QAで管理する。
