# Gestión de administradores desde la consola (el primer administrador se crea así).
#   bin/rails "admin:grant[ana@example.com]"
#   bin/rails "admin:revoke[ana@example.com]"
#   bin/rails admin:list
namespace :admin do
  find_user = lambda do |email|
    User.find_by("lower(email) = ?", email.to_s.strip.downcase) || abort("No existe ningún usuario con el email '#{email}'")
  end

  desc "Da permisos de administrador a un usuario (y lo reactiva si estaba desactivado)"
  task :grant, [:email] => :environment do |_task, args|
    user = find_user.call(args[:email])
    user.update!(admin: true, disabled_at: nil)
    puts "#{user.email} ahora es administrador"
  end

  desc "Quita los permisos de administrador a un usuario"
  task :revoke, [:email] => :environment do |_task, args|
    user = find_user.call(args[:email])
    abort "#{user.email} es el único administrador activo; nombra otro antes" if User.admins.where.not(id: user.id).none?

    user.update!(admin: false)
    puts "#{user.email} ya no es administrador"
  end

  desc "Lista los administradores"
  task list: :environment do
    admins = User.where(admin: true).order(:email)
    puts admins.any? ? admins.map { |u| "#{u.email}#{u.disabled? ? ' (desactivado)' : ''}" } : "No hay administradores. Crea uno con: bin/rails \"admin:grant[email]\""
  end
end
