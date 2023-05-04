import React from 'react'

function PlotModal({plot, show, close}) {
  
  if (!show) return null;

  return (
    <div className='overlay'>
      <div className='modalContainer'>
        <button className='closeBtn' onClick={close}>X</button>
        <img className='plot' src={plot} alt='Plot'/>
      </div>
    </div>
  )
}

export default PlotModal
