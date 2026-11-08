module Srs
  # Variante simplificada de SM-2 con cuatro botones (como Anki).
  # rating: 1 = otra vez, 2 = difícil, 3 = bien, 4 = fácil
  module Scheduler
    MIN_EASE = 1.3
    AGAIN_DELAY = 10.minutes
    RATINGS = (1..4).freeze

    module_function

    # Devuelve los nuevos valores sin guardar: { interval:, ease:, repetitions:, next_review_at:, level_delta: }
    def next_state(interval:, ease:, repetitions:, rating:, now: Time.current)
      raise ArgumentError, "rating inválido" unless RATINGS.cover?(rating)

      case rating
      when 1
        { interval: 0.0, ease: [ease - 0.2, MIN_EASE].max, repetitions: 0, next_review_at: now + AGAIN_DELAY, level_delta: -4 }
      when 2
        days = [interval * 1.2, 1.0].max
        { interval: days, ease: [ease - 0.15, MIN_EASE].max, repetitions: repetitions + 1, next_review_at: now + days.days, level_delta: 0 }
      when 3
        days = base_interval(interval, ease, repetitions)
        { interval: days, ease: ease, repetitions: repetitions + 1, next_review_at: now + days.days, level_delta: 1 }
      when 4
        days = (base_interval(interval, ease, repetitions) * 1.3).round(2)
        days = [days, 4.0].max
        { interval: days, ease: ease + 0.15, repetitions: repetitions + 1, next_review_at: now + days.days, level_delta: 1 }
      end
    end

    def base_interval(interval, ease, repetitions)
      case repetitions
      when 0 then 1.0
      when 1 then 3.0
      else (interval * ease).round(2)
      end
    end

    # Segundos hasta la próxima revisión para cada botón (para mostrarlo en la UI).
    def preview(lingq, now: Time.current)
      RATINGS.to_h do |rating|
        state = next_state(interval: lingq.interval, ease: lingq.ease, repetitions: lingq.repetitions, rating: rating, now: now)
        [rating, (state[:next_review_at] - now).round]
      end
    end
  end
end
