import { useState, useEffect, useRef } from 'react';

const DEFAULT_CARD_ORDER = ['feature', 'package', 'vip'];

/**
 * Custom hook to handle reordering mechanics of dashboard cards
 * and persist visibility and orders in local storage.
 */
export default function useCardReorder() {
  const [cardOrder, setCardOrder] = useState(() => {
    try {
      const saved = localStorage.getItem('adminCardOrder');
      return saved ? JSON.parse(saved) : DEFAULT_CARD_ORDER;
    } catch { return DEFAULT_CARD_ORDER; }
  });

  const [cardVisibility, setCardVisibility] = useState(() => {
    try {
      const saved = localStorage.getItem('adminCardVisibility');
      return saved ? JSON.parse(saved) : { feature: true, package: true, vip: true };
    } catch { return { feature: true, package: true, vip: true }; }
  });

  const [draggedCard, setDraggedCard] = useState(null);
  const [dragOverCard, setDragOverCard] = useState(null);
  const dragNodeRef = useRef(null);

  // Persist order updates
  useEffect(() => {
    localStorage.setItem('adminCardOrder', JSON.stringify(cardOrder));
  }, [cardOrder]);

  // Persist visibility updates
  useEffect(() => {
    localStorage.setItem('adminCardVisibility', JSON.stringify(cardVisibility));
  }, [cardVisibility]);

  const handleDragStart = (e, cardId) => {
    setDraggedCard(cardId);
    dragNodeRef.current = e.target;
    e.dataTransfer.effectAllowed = 'move';
    
    // Smooth opacity ghost effect
    setTimeout(() => { 
      if (dragNodeRef.current) dragNodeRef.current.style.opacity = '0.4'; 
    }, 0);
  };

  const handleDragEnd = () => {
    if (dragNodeRef.current) dragNodeRef.current.style.opacity = '1';
    setDraggedCard(null);
    setDragOverCard(null);
    dragNodeRef.current = null;
  };

  const handleDragOver = (e, cardId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (cardId !== draggedCard) setDragOverCard(cardId);
  };

  const handleDrop = (e, targetCardId) => {
    e.preventDefault();
    if (!draggedCard || draggedCard === targetCardId) return;

    setCardOrder(prev => {
      const newOrder = [...prev];
      const fromIdx = newOrder.indexOf(draggedCard);
      const toIdx = newOrder.indexOf(targetCardId);
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, draggedCard);
      return newOrder;
    });

    setDraggedCard(null);
    setDragOverCard(null);
  };

  const toggleCardVisibility = (cardId) => {
    setCardVisibility(prev => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  return {
    cardOrder,
    cardVisibility,
    draggedCard,
    dragOverCard,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    toggleCardVisibility
  };
}
