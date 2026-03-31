import { useEffect, useState } from 'react';
import { ArrowLeft, Flame, PlaneTakeoff, Ticket } from 'lucide-react';
import BoardingBarcodeTool from './components/BoardingBarcodeTool';
import FireSimulatorTool from './components/FireSimulatorTool';
import SkyscannerTool, { SkyscannerHistoryPage } from './components/SkyscannerTool';

type Route = 'home' | 'boarding' | 'fire' | 'skyscanner' | 'skyscanner-history';

const routeByHash: Record<string, Route> = {
  '#/boarding': 'boarding',
  '#/fire': 'fire',
  '#/skyscanner': 'skyscanner',
  '#/skyscanner/history': 'skyscanner-history',
};

const hashByRoute: Record<Route, string> = {
  home: '#/',
  boarding: '#/boarding',
  fire: '#/fire',
  skyscanner: '#/skyscanner',
  'skyscanner-history': '#/skyscanner/history',
};

const getRouteFromHash = (): Route => routeByHash[window.location.hash] ?? 'home';

const App = () => {
  const [route, setRoute] = useState<Route>(getRouteFromHash());

  useEffect(() => {
    const onHashChange = () => setRoute(getRouteFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (nextRoute: Route) => {
    window.location.hash = hashByRoute[nextRoute];
  };

  if (route === 'boarding') {
    return (
      <div>
        <button className="button back-button" onClick={() => navigate('home')}>
          <ArrowLeft size={18} /> トップへ戻る
        </button>
        <BoardingBarcodeTool />
      </div>
    );
  }

  if (route === 'fire') {
    return (
      <div>
        <button className="button back-button" onClick={() => navigate('home')}>
          <ArrowLeft size={18} /> トップへ戻る
        </button>
        <FireSimulatorTool />
      </div>
    );
  }

  if (route === 'skyscanner') {
    return (
      <div>
        <button className="button back-button" onClick={() => navigate('home')}>
          <ArrowLeft size={18} /> トップへ戻る
        </button>
        <SkyscannerTool onOpenHistory={() => navigate('skyscanner-history')} />
      </div>
    );
  }

  if (route === 'skyscanner-history') {
    return (
      <div>
        <button className="button back-button" onClick={() => navigate('skyscanner')}>
          <ArrowLeft size={18} /> Skyscannerへ戻る
        </button>
        <SkyscannerHistoryPage />
      </div>
    );
  }

  return (
    <>
      <div className="card hero">
        <h1>TRaVeLiNG Tools</h1>
        <p className="hero-subtitle">使いたいツールを選んで開始してください。</p>
      </div>

      <section className="tools-grid">
        <article className="tool-card card">
          <h2><Ticket size={20} /> Skyscanner Link</h2>
          <p className="tool-description">
            Skyscannerのフライト検索URLをアフィリエイトリンクに変換します。
          </p>
          <button className="button" onClick={() => navigate('skyscanner')}>このツールを開く</button>
        </article>

        <article className="tool-card card">
          <h2><PlaneTakeoff size={20} /> Boarding Barcode</h2>
          <p className="tool-description">
            搭乗券の入力情報をもとに、IATA文字列と Aztec / PDF417 バーコードを生成します。
          </p>
          <button className="button" onClick={() => navigate('boarding')}>このツールを開く</button>
        </article>

        <article className="tool-card card">
          <h2><Flame size={20} /> FIRE Simulator</h2>
          <p className="tool-description">
            資産推移、リタイア時資産、資産寿命を可視化して、FIRE計画の試算ができます。
          </p>
          <button className="button" onClick={() => navigate('fire')}>このツールを開く</button>
        </article>
      </section>
    </>
  );
};

export default App;
