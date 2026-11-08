require "rails_helper"

RSpec.describe Srs::Scheduler do
  let(:now) { Time.zone.parse("2026-01-01 12:00") }

  it "programa intervalos crecientes con 'bien'" do
    state = described_class.next_state(interval: 0, ease: 2.5, repetitions: 0, rating: 3, now: now)
    expect(state[:interval]).to eq(1.0)
    state = described_class.next_state(interval: 1, ease: 2.5, repetitions: 1, rating: 3, now: now)
    expect(state[:interval]).to eq(3.0)
    state = described_class.next_state(interval: 3, ease: 2.5, repetitions: 2, rating: 3, now: now)
    expect(state[:interval]).to eq(7.5)
  end

  it "reinicia con 'otra vez' y no baja de la facilidad mínima" do
    state = described_class.next_state(interval: 10, ease: 1.35, repetitions: 4, rating: 1, now: now)
    expect(state).to include(interval: 0.0, repetitions: 0, ease: 1.3, next_review_at: now + 10.minutes)
  end
end
