import './styles/App.css';
import { Link } from 'react-router-dom';
import Graph from './Network';

function Home()
{
  return (
    <>
    <div>
      <ul>
        <li><Link to ="/" style={{ textDecoration: 'none', color: "white" }}>Home</Link></li>
        <li style={{float: "right"}}><Link to="/About" style={{ textDecoration: 'none', color: "white"}}>About</Link></li>
      </ul>
    </div>
    <h1>Power Grid Model Visualization Tool</h1>
    <div className='visDiv'>
      <Graph />
    </div>
    </>
  );
}

export function About()
{
  return (
    <div>
      <ul>
        <li><Link to ="/" style={{ textDecoration: 'none', color: "white" }}>Home</Link></li>
        <li style={{float: "right"}}><Link to="/About" style={{ textDecoration: 'none', color: "white"}}>About</Link></li>
      </ul>
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
