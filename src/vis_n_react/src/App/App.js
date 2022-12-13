import './App.css';
import { Link } from 'react-router-dom';
import Graph from './Graph/Graph';

function Home()
{
  return (
    <>
    <header>
        <h1 className="title">Power Grid Model Visualization Tool</h1>
        <nav>
            <ul className="nav-links">
                <li><Link to ="/" style={{ textDecoration: 'none', color: "white" }}>Home</Link></li>
                <li><Link to="/About" style={{ textDecoration: 'none', color: "white"}}>About</Link></li>
            </ul>
        </nav>
    </header>
    <main>
      <Graph />
    </main>
    </>
  );
}

export function About()
{
  return (
    <div>
      <header>
        <h1 className="title">Power Grid Model Visualization Tool</h1>
        <nav>
            <ul className="nav-links">
                <li><Link to ="/" style={{ textDecoration: 'none', color: "white" }}>Home</Link></li>
                <li><Link to="/About" style={{ textDecoration: 'none', color: "white"}}>About</Link></li>
            </ul>
        </nav>
    </header>
      <h1>About The tool</h1>
    </div>
  );
}

export function App() 
{
  return (
    <Home />
  );
}
