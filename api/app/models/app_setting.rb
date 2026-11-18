class AppSetting < ApplicationRecord
  belongs_to :updated_by, class_name: "User", optional: true

  validates :key, presence: true, uniqueness: true
end
