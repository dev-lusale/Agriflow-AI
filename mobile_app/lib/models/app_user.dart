import '../core/utils/json.dart';

enum UserRole { farmer, buyer, supplier, transporter, expert, distributor, admin, superAdmin, unknown }

UserRole roleFrom(String r) => switch (r) {
      'FARMER' => UserRole.farmer,
      'BUYER' => UserRole.buyer,
      'SUPPLIER' => UserRole.supplier,
      'TRANSPORTER' => UserRole.transporter,
      'EXPERT' => UserRole.expert,
      'DISTRIBUTOR' => UserRole.distributor,
      'ADMIN' => UserRole.admin,
      'SUPER_ADMIN' => UserRole.superAdmin,
      _ => UserRole.unknown,
    };

const roleLabels = {
  UserRole.farmer: 'Farmer',
  UserRole.buyer: 'Buyer',
  UserRole.supplier: 'Agricultural supplier',
  UserRole.transporter: 'Transporter',
  UserRole.expert: 'Agricultural expert',
  UserRole.distributor: 'Distributor',
  UserRole.admin: 'Administrator',
  UserRole.superAdmin: 'Super administrator',
  UserRole.unknown: 'User',
};

class AppUser {
  AppUser(this.raw);
  final Json raw;

  String get id => raw.s('id');
  String get email => raw.s('email');
  String? get phone => raw.sn('phone');
  String get roleCode => raw.s('role');
  UserRole get role => roleFrom(roleCode);
  String get roleLabel => roleLabels[role]!;
  Json get profile => raw.m('profile');
  String get fullName => profile.s('fullName', email.split('@').first);
  String get firstName => fullName.split(' ').first;
  String? get province => profile.sn('province');
  String? get district => profile.sn('district');
  String? get avatarUrl => raw.sn('avatarUrl');
  bool get emailVerified => raw.b('emailVerified');
  bool get onboardingCompleted => raw.b('onboardingCompleted');
  bool get adminVerified => raw.sn('verifiedAt') != null;

  bool get isFarmer => role == UserRole.farmer;
  bool get isAdmin => role == UserRole.admin || role == UserRole.superAdmin;
  bool get isSeller => role == UserRole.supplier || role == UserRole.distributor;
  bool get isCarrier => role == UserRole.transporter || role == UserRole.distributor;
  bool get isExpert => role == UserRole.expert;
  bool get holdsStock => isFarmer || isSeller;
}
