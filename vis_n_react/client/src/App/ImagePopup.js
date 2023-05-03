import React from 'react';

const ImagePopup = ({ imageUrl, onClose }) => {
  return (
    <div className="image-popup">
      <img src={imageUrl} alt="popup" />
      <button onClick={onClose}>Close</button>
    </div>
  );
};

export default ImagePopup;
