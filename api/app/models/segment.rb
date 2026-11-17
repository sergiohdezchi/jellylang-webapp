class Segment < ApplicationRecord
  belongs_to :lesson

  def as_json(*)
    {
      id: id,
      position: position,
      paragraph: paragraph,
      text: text,
      start: start_time,
      end: end_time,
      word_times: word_times
    }
  end
end
