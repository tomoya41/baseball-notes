# Pixelのホーム画面版

2026-10-21。Chromeから公開Web版をホーム画面へ追加できるよう、manifestと192/512px PNGを追加。アイコンはアプリ所有の既存Android `baseball_brand.xml` の図形を再利用したもの。第三者の写真・球団ロゴ・新しい外部依存はない。追加費用¥0。

`id` / `scope` は公開ディレクトリ相対、起動先は同じ範囲の `#/NPB/home`。GitHub Pagesのサブパスと既存Hash Routerを保つ。アプリ・データの公開は既存preserve-only手順を使い、DBへの接続や保護payload変更を行わない。

ChromeのメニューからのインストールはService Workerなしでも対応する。[Chrome公式](https://developer.chrome.com/blog/update-install-criteria)に従い、インストールだけを目的とした空のfetch handlerは追加しない。通常のオンライン起動・再読み込みで公開版を使う。閉じたままの即時更新、Push、完全なオフラインcold startは保証しない。既存の検証済みresponse cacheを維持する。

既存USB導入版 `com.tomoya41.baseballnotes` はそのまま残す。Chromeのホーム画面版は別の保存領域で、ネイティブ版のFavorites / Collections / Watchは自動移行しない。データ削除や無断アンインストールは不要。WebAPKの生成が利用できない場合、Chromeはショートカットへfallbackすることがある。実際の導入方式と動作はPixelで確認する。

手動の場合：PixelのChromeで[公開版](https://tomoya41.github.io/baseball-notes/#/NPB/home)を開く → ︙ →「ホーム画面に追加」→「インストール」。ホームから起動し、アドレスバーなしの画面、ホーム/試合/選手/記録/My、戻る操作を確認する。TalkBackや通信断の確認は別の実機QAで管理する。
