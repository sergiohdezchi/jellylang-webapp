class AddLockoutsAndPasswordResetToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :verification_locked_until, :datetime

    add_column :users, :reset_code_digest, :string
    add_column :users, :reset_code_sent_at, :datetime
    add_column :users, :reset_attempts, :integer, null: false, default: 0
    add_column :users, :reset_locked_until, :datetime

    # Al restablecer la contraseña se cierran las sesiones anteriores
    add_column :users, :password_changed_at, :datetime
  end
end
