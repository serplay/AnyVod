import React, { useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PosterImage, getTMDBImageUrl } from './OptimizedImage'
import moviePlaceholder from '../assets/movie.png'

export default function CategoryRow({ title, items = [] }) {
  const navigate = useNavigate()
  const scrollContainerRef = useRef(null)
  const [preloadedIndexes, setPreloadedIndexes] = useState(new Set())

  // Preload images by creating Image objects
  const preloadImages = useCallback((startIndex, count) => {
    const newPreloaded = new Set(preloadedIndexes)
    for (let i = startIndex; i < Math.min(startIndex + count, items.length); i++) {
      if (!newPreloaded.has(i) && items[i]?.poster_path) {
        const img = new Image()
        img.src = getTMDBImageUrl(items[i].poster_path, 'poster', 'medium')
        newPreloaded.add(i)
      }
    }
    setPreloadedIndexes(newPreloaded)
  }, [items, preloadedIndexes])

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current
      const viewportWidth = window.innerWidth
      const scrollAmount = viewportWidth < 480 ? 300 : viewportWidth < 768 ? 500 : 800
      
      // Calculate current visible range based on scroll position
      const cardWidth = 170 // approximate card width including gap
      const currentScrollLeft = container.scrollLeft
      
      if (direction === 'right') {
        // Preload the next 4 images beyond what will be visible after scroll
        const afterScrollLastVisible = Math.floor((currentScrollLeft + scrollAmount + container.clientWidth) / cardWidth)
        preloadImages(afterScrollLastVisible + 1, 4)
      }
      
      container.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' })
    }
  }

  const handleCardClick = (item) => {
    // Determine if TV show based on media_type or presence of first_air_date (TV) vs release_date (movie)
    const isTv = item.media_type === 'tv' || (item.first_air_date && !item.release_date)
    if (isTv) {
      navigate(`/tv/${item.id}`)
    } else {
      navigate(`/movie/${item.id}`)
    }
  }

  if (!items || items.length === 0) return null

  return (
    <div className="category-row">
      <h2 className="category-title">{title}</h2>
      <div className="category-slider-wrapper">
        <button className="category-arrow category-arrow-left" onClick={() => scroll('left')}>
          ‹
        </button>
        <div className="category-scroll-container" ref={scrollContainerRef}>
          {items.map((item, index) => (
            <div
              key={item.id}
              className="category-card"
              onClick={() => handleCardClick(item)}
              itemtype="https://schema.org/Movie"
            >
              {item.poster_path ? (
                <PosterImage
                  path={item.poster_path}
                  alt={item.title || item.name}
                  size="medium"
                  priority={index < 8}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <img 
                  src={moviePlaceholder} 
                  alt={item.title || item.name} 
                  className="placeholder-img"
                  width="160"
                  height="240"
                />
              )}
              <div className="category-card-overlay">
                <h4>{item.title || item.name}</h4>
                <p className="category-rating">
                  ⭐ {item.vote_average?.toFixed(1)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <button className="category-arrow category-arrow-right" onClick={() => scroll('right')}>
          ›
        </button>
      </div>
    </div>
  )
}
