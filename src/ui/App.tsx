import { useCallback, useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import type { Services } from "../app/services";
import type {
  CatalogResult,
  Favorite,
  League,
  Player,
  PlayerCatalog,
  Statistics,
} from "../domain/models";
import { formatMetric, metrics } from "../domain/metrics";

const date = (value: string) => new Date(value).toLocaleString("ja-JP");
function MetricCards({
  stats,
  advanced,
}: {
  stats: Statistics;
  advanced: boolean;
}) {
  return (
    <div className="metrics">
      {Object.entries(stats.metrics).map(([id, value]) => {
        const definition = metrics[id];
        if (!definition || definition.advanced !== advanced) return null;
        return (
          <article className="metric" key={id}>
            <div className="eyebrow">
              {definition.name} <span>{definition.fullName}</span>
            </div>
            <strong className="metric-value">
              {formatMetric(value, definition)}
            </strong>
            {value.status !== "available" && (
              <p className="muted">{value.reason}</p>
            )}
            <details>
              <summary>{definition.name}の意味</summary>
              <p>{definition.description}</p>
              <p>{definition.interpretation}</p>
              <p className="muted">{definition.caveat}</p>
            </details>
          </article>
        );
      })}
    </div>
  );
}

function PlayerList({
  catalog,
  favorites,
  onlyFavorites = false,
}: {
  catalog: PlayerCatalog;
  favorites: Favorite[];
  onlyFavorites?: boolean;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.normalize("NFKC").toLocaleLowerCase().trim();
  const shown = catalog.profiles.filter(({ player }) => {
    const team = catalog.teams.find((t) => t.id === player.teamId);
    return (
      (!onlyFavorites ||
        favorites.some(
          (f) => f.kind === "player" && f.entityId === player.id,
        )) &&
      [
        player.name,
        ...player.searchNames,
        player.position ?? "",
        team?.name ?? "",
      ]
        .join(" ")
        .normalize("NFKC")
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    );
  });
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            {onlyFavorites ? "MY BASEBALL" : "PLAYER DIRECTORY"}
          </p>
          <h1>{onlyFavorites ? "お気に入り" : "選手を探す"}</h1>
        </div>
        <span className="count">{shown.length}人</span>
      </div>
      <p className="muted">
        {onlyFavorites
          ? "気になる選手を、いつでも手元に。"
          : "名前、読み方、チーム、守備位置から。"}
      </p>
      <label className="search-label" htmlFor="player-search">
        選手検索
      </label>
      <input
        id="player-search"
        type="search"
        placeholder="名前・チーム・守備位置"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      <div className="player-list">
        {shown.map(({ player }, index) => (
          <Link
            className="player-card"
            key={player.id}
            to={`/${catalog.league}/players/${encodeURIComponent(player.id)}`}
          >
            <span className="avatar" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="player-info">
              <strong>{player.name}</strong>
              <span>
                {catalog.teams.find((t) => t.id === player.teamId)?.name ??
                  "所属情報なし"}{" "}
                · {player.position ?? "守備位置不明"}
              </span>
            </span>
            <span
              className="card-arrow"
              aria-label={
                favorites.some(
                  (f) => f.kind === "player" && f.entityId === player.id,
                )
                  ? "お気に入り登録済み"
                  : undefined
              }
            >
              {favorites.some(
                (f) => f.kind === "player" && f.entityId === player.id,
              )
                ? "★"
                : "↗"}
            </span>
          </Link>
        ))}
      </div>
      {shown.length === 0 && (
        <p className="empty">
          {onlyFavorites
            ? "登録した選手がここに表示されます。選手詳細の「お気に入りに追加」から登録できます。"
            : "一致する選手はいません。検索語を変えてお試しください。"}
        </p>
      )}
      {onlyFavorites &&
        favorites.some(
          (f) =>
            f.league === catalog.league &&
            f.kind === "player" &&
            !catalog.profiles.some((p) => p.player.id === f.entityId),
        ) && (
          <p className="notice">
            このデータに含まれない登録選手がいます。お気に入りの記録は端末に保持しています。
          </p>
        )}
    </>
  );
}

function PlayerDetail({
  catalog,
  favorites,
  toggle,
  saving,
}: {
  catalog: PlayerCatalog;
  favorites: Favorite[];
  toggle: (player: Player) => void;
  saving: boolean;
}) {
  const { playerId } = useParams();
  const profile = catalog.profiles.find((p) => p.player.id === playerId);
  if (!profile)
    return (
      <>
        <h1>選手が見つかりません</h1>
        <Link to={`/${catalog.league}/players`}>選手一覧へ戻る</Link>
      </>
    );
  const { player } = profile;
  const isFavorite = favorites.some(
    (f) => f.kind === "player" && f.entityId === player.id,
  );
  const stats = catalog.statistics.filter((s) => s.playerId === player.id);
  return (
    <>
      <Link className="back-link" to={`/${catalog.league}/players`}>
        ← 選手一覧
      </Link>
      <section className="profile-header">
        <p className="eyebrow">{catalog.league} / PLAYER PROFILE</p>
        <h1>{player.name}</h1>
        <p>
          {catalog.teams.find((t) => t.id === player.teamId)?.name ??
            "所属情報なし"}{" "}
          · {player.position ?? "守備位置不明"}
        </p>
        <div className="profile-meta">
          <span>背番号 {profile.jersey ?? "不明"}</span>
          <span>
            {profile.throws ?? "不明"}投 / {profile.bats ?? "不明"}打
          </span>
        </div>
        <button
          className={isFavorite ? "button favorited" : "button"}
          aria-pressed={isFavorite}
          disabled={saving}
          onClick={() => {
            toggle(player);
          }}
        >
          {saving
            ? "保存中…"
            : isFavorite
              ? "★ お気に入り登録済み"
              : "☆ お気に入りに追加"}
        </button>
      </section>
      {catalog.source.kind === "sample" && (
        <p className="notice">
          この選手・チーム・成績はすべて架空のサンプルです。
        </p>
      )}
      {stats.length === 0 && (
        <p className="empty">成績はまだ提供されていません。</p>
      )}
      {stats.map((stat) => (
        <section className="stats-section" key={`${stat.group}:${stat.season}`}>
          <div className="section-heading">
            <h2>
              {stat.season} · {stat.group === "hitting" ? "打撃" : "投球"}
            </h2>
            <span className="tag">
              {stat.seasonType === "regular"
                ? "公式戦"
                : stat.seasonType === "preseason"
                  ? "オープン戦"
                  : "ポストシーズン"}
              {stat.source.kind === "sample" ? "の形式 / サンプル" : ""}
            </span>
          </div>
          {stat.completeness === "partial" && (
            <p className="muted">一部の項目は未提供です。</p>
          )}
          <MetricCards stats={stat} advanced={false} />
          {Object.keys(stat.metrics).some((id) => metrics[id]?.advanced) && (
            <details className="advanced">
              <summary>詳しい指標を見る</summary>
              <MetricCards stats={stat} advanced />
            </details>
          )}
        </section>
      ))}
    </>
  );
}

function LeagueView({
  league,
  services,
  favorites,
  toggle,
  saving,
}: {
  league: League;
  services: Services;
  favorites: Favorite[];
  toggle: (player: Player) => void;
  saving: boolean;
}) {
  const [result, setResult] = useState<CatalogResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    let active = true;
    void services.players
      .load(league)
      .then((value) => {
        if (active) setResult(value);
      })
      .catch(() => {
        if (active)
          setError(
            "選手データを取得できません。接続を確認して再試行してください。",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const timer = setInterval(() => {
      setClock(Date.now());
    }, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [league, services]);
  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setResult(await services.players.load(league, true));
      setClock(Date.now());
    } catch {
      setError(
        "選手データを取得できません。接続を確認して再試行してください。",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="muted">
          選手データを読み込み中…
        </p>
      )}
      {!result && !loading && (
        <button
          className="button"
          onClick={() => {
            void refresh();
          }}
        >
          再試行
        </button>
      )}
      {result && (
        <>
          {result.data.source.kind === "sample" && (
            <div className="sample-banner">
              <span aria-hidden="true">◈</span> サンプルモード ·
              実在の選手・成績ではありません
            </div>
          )}
          <Routes>
            <Route
              path="home"
              element={
                <section className="hero">
                  <p className="eyebrow">BASEBALL, A LITTLE CLOSER.</p>
                  <h1>
                    数字の先に、
                    <br />
                    選手が見える。
                  </h1>
                  <p>
                    いつもの野球に、もうひとつの視点を。
                    <br />
                    選手の成績と、数字の意味を見てみよう。
                  </p>
                  <Link className="button" to={`/${league}/players`}>
                    選手を探す →
                  </Link>
                  {result.data.source.kind === "sample" && (
                    <p className="muted">
                      現在は架空選手によるプレビューです。
                    </p>
                  )}
                </section>
              }
            />
            <Route
              path="players"
              element={
                <PlayerList catalog={result.data} favorites={favorites} />
              }
            />
            <Route
              path="players/:playerId"
              element={
                <PlayerDetail
                  catalog={result.data}
                  favorites={favorites}
                  toggle={toggle}
                  saving={saving}
                />
              }
            />
            <Route
              path="favorites"
              element={
                <PlayerList
                  catalog={result.data}
                  favorites={favorites}
                  onlyFavorites
                />
              }
            />
            <Route
              path="*"
              element={<Navigate to={`/${league}/players`} replace />}
            />
          </Routes>
          <aside className="data-note" aria-label="データの状態">
            <div className="section-heading">
              <strong>
                {result.freshness.state === "stale" ||
                clock >= Date.parse(result.freshness.expiresAt)
                  ? "更新確認が必要なデータ"
                  : "保存期間内のデータ"}
              </strong>
              <button
                className="text-button"
                disabled={loading}
                onClick={() => {
                  void refresh();
                }}
              >
                {loading ? "確認中…" : "更新を確認"}
              </button>
            </div>
            <p>
              {result.data.source.label} ·{" "}
              {result.freshness.origin === "cache"
                ? "端末キャッシュ"
                : "提供元から取得"}
            </p>
            <p>
              データ更新：{date(result.data.source.updatedAt)}
              <br />
              取得：{date(result.freshness.fetchedAt)}
            </p>
            {result.warnings.map((warning) => (
              <p className="warning" role="status" key={warning}>
                {warning}
              </p>
            ))}
          </aside>
        </>
      )}
    </>
  );
}

export function App({ services }: { services: Services }) {
  const location = useLocation();
  const league: League =
    location.pathname.split("/")[1] === "MLB" ? "MLB" : "NPB";
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [saving, setSaving] = useState(false);
  const [favoriteMessage, setFavoriteMessage] = useState("");
  const [favoriteError, setFavoriteError] = useState(false);
  useEffect(() => {
    let active = true;
    void services.favorites
      .list()
      .then((items) => {
        if (active) setFavorites(items);
      })
      .catch(() => {
        if (active) {
          setFavoriteMessage(
            "お気に入りを読み込めません。保存データは保持しています。",
          );
          setFavoriteError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [services]);
  const toggle = useCallback(
    (player: Player) => {
      setSaving(true);
      void services.favorites
        .toggle({ kind: "player", entityId: player.id, league: player.league })
        .then((items) => {
          setFavorites(items);
          setFavoriteError(false);
          setFavoriteMessage(
            items.some((item) => item.entityId === player.id)
              ? "お気に入りを端末に保存しました。"
              : "お気に入りから削除しました。",
          );
        })
        .catch(() => {
          setFavoriteError(true);
          setFavoriteMessage(
            "お気に入りを保存できません。端末の保存領域を確認してください。",
          );
        })
        .finally(() => {
          setSaving(false);
        });
    },
    [services],
  );
  const switchPath = (next: League) =>
    `/${next}/${location.pathname.endsWith("/favorites") ? "favorites" : location.pathname.endsWith("/home") ? "home" : "players"}`;
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        本文へ移動
      </a>
      <header className="app-header">
        <Link className="brand" to={`/${league}/home`}>
          <span className="brand-mark" aria-hidden="true">
            BN
          </span>
          <span>
            BASEBALL
            <br />
            <b>NOTES</b>
          </span>
        </Link>
        <span className="preview-badge">PREVIEW</span>
      </header>
      <div className="league-bar">
        <nav className="league-switch" aria-label="リーグ切替">
          {(["NPB", "MLB"] as const).map((item) => (
            <Link
              key={item}
              aria-current={league === item ? "true" : undefined}
              to={switchPath(item)}
            >
              {item}
            </Link>
          ))}
        </nav>
        <span className="muted">野球の数字を、身近に。</span>
      </div>
      {favoriteMessage && (
        <p
          className={favoriteError ? "notice error" : "notice"}
          role={favoriteError ? "alert" : "status"}
        >
          {favoriteMessage}
        </p>
      )}
      <main id="main-content" tabIndex={-1}>
        <Routes>
          <Route
            path="/NPB/*"
            element={
              <LeagueView
                key="NPB"
                league="NPB"
                services={services}
                favorites={favorites}
                toggle={toggle}
                saving={saving}
              />
            }
          />
          <Route
            path="/MLB/*"
            element={
              <LeagueView
                key="MLB"
                league="MLB"
                services={services}
                favorites={favorites}
                toggle={toggle}
                saving={saving}
              />
            }
          />
          <Route path="*" element={<Navigate to="/NPB/home" replace />} />
        </Routes>
      </main>
      <nav className="bottom-nav" aria-label="基本ナビゲーション">
        <NavLink to={`/${league}/home`}>ホーム</NavLink>
        <NavLink to={`/${league}/players`}>選手</NavLink>
        <NavLink to={`/${league}/favorites`}>お気に入り</NavLink>
      </nav>
    </div>
  );
}
