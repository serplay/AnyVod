import React, { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PosterImage } from './OptimizedImage'
import moviePlaceholder from '../assets/movie.png'

export default function CategoryRow({ title, items = [] }) {
  const navigate = useNavigate()
  const scrollContainerRef = useRef(null)

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      // Responsive scroll amount based on viewport width
      const viewportWidth = window.innerWidth
      const scrollAmount = viewportWidth < 480 ? 300 : viewportWidth < 768 ? 500 : 800
      scrollContainerRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' })
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
          {items.map((item) => (
            <div
              key={item.id}
              className="category-card"
              onClick={() => handleCardClick(item)}
            >
              {item.poster_path ? (
                <PosterImage
                  path={item.poster_path}
                  alt={item.title || item.name}
                  size="medium"
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
