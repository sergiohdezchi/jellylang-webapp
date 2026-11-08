class UserWord < ApplicationRecord
  STATUSES = %w[learning known ignored].freeze

  belongs_to :user
  belongs_to :word

  validates :status, inclusion: { in: STATUSES }
  validates :level, inclusion: { in: 1..4 }
end
