import React from 'react';
import "../styles/PlotModal.css";

function PlotModal({plot, show, close}) {
  
  if (!show) return null;

  return (
    <>
      <div className='modal'>
        <div className='modal-overlay' onClick={close}>
          <div className='modal-content'>

            <img className='plot' src={plot} alt='Plot'/>
            <button className='closeBtn' onClick={close}>CLOSE</button>

          </div>
        </div>
      </div>

    </>
  )
}

export default PlotModal
