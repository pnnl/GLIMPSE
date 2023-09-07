import React from 'react';
import ReactDom from "react-dom";
import "../styles/PlotModal.css";

const PlotModal = ({plot, show, close}) => {
  
   if (!show) return null;

   return ReactDom.createPortal(
      <>
         <div className='modal'>
            <div className='modal-overlay' onClick={close}>
               <div className='modal-content'>

               <img className='plot' src={plot} alt='Plot'/>
               <button className='closeBtn' onClick={close}>CLOSE</button>

               </div>
            </div>
         </div>
      </>,
      document.getElementById("portal")
   )
}

export default PlotModal
