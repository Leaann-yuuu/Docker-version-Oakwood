import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/router/app_router.dart';
import '../../core/utils/plate_input_formatter.dart';
import '../../core/utils/toast_helper.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/auth/auth_page_layout.dart';
import '../../widgets/auth/underline_input_field.dart';
import '../../widgets/custom_calendar_picker.dart';
import '../../widgets/modals/success_modal.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _imagePicker = ImagePicker();

  final _firstNameCtrl = TextEditingController();
  final _middleNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _birthDateCtrl = TextEditingController();
  final _contactCtrl = TextEditingController();
  final _plateNumberCtrl = TextEditingController();
  final _otherVehicleTypeCtrl = TextEditingController();

  static const List<String> _vehicleTypes = [
    'Sedan',
    'SUV',
    'Van / MPV',
    'Pickup Truck',
    'Hatchback / Compact',
    'Motorcycle / Scooter',
    'Bicycle / E-Bike',
    'Other',
  ];

  String? _selectedVehicleType;
  String? _orCrImagePath;
  String? _validIdImagePath;

  int _selectedGenderId = 1; // 1: Male, 2: Female, 3: Prefer Not to Say
  bool _isLoading = false;

  final Map<String, String> _fieldErrors = {};

  late AnimationController _animController;
  late Animation<double> _barAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _barAnim = CurvedAnimation(
      parent: _animController,
      curve: Curves.fastOutSlowIn,
    );
    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    _firstNameCtrl.dispose();
    _middleNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _emailCtrl.dispose();
    _birthDateCtrl.dispose();
    _contactCtrl.dispose();
    _plateNumberCtrl.dispose();
    _otherVehicleTypeCtrl.dispose();
    super.dispose();
  }

  Future<String?> _promptImagePicker({
    required String title,
    required String description,
  }) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: const Color(0xFF1E1B4B),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20.r)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 18.h),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 15.sp,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              SizedBox(height: 4.h),
              Text(
                description,
                style: TextStyle(
                  fontSize: 12.sp,
                  color: Colors.white70,
                ),
              ),
              SizedBox(height: 14.h),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  padding: EdgeInsets.all(8.r),
                  decoration: BoxDecoration(
                    color: const Color(0xFF7C3AED).withAlpha(50),
                    borderRadius: BorderRadius.circular(10.r),
                  ),
                  child: Icon(Icons.camera_alt_rounded, color: const Color(0xFFC4B5FD), size: 20.r),
                ),
                title: Text('Take a Photo', style: TextStyle(color: Colors.white, fontSize: 14.sp)),
                onTap: () => Navigator.of(ctx).pop(ImageSource.camera),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  padding: EdgeInsets.all(8.r),
                  decoration: BoxDecoration(
                    color: const Color(0xFF7C3AED).withAlpha(50),
                    borderRadius: BorderRadius.circular(10.r),
                  ),
                  child: Icon(Icons.photo_library_rounded, color: const Color(0xFFC4B5FD), size: 20.r),
                ),
                title: Text('Choose from Gallery', style: TextStyle(color: Colors.white, fontSize: 14.sp)),
                onTap: () => Navigator.of(ctx).pop(ImageSource.gallery),
              ),
            ],
          ),
        ),
      ),
    );

    if (source == null) return null;

    try {
      final picked = await _imagePicker.pickImage(
        source: source,
        maxWidth: 1800,
        maxHeight: 1800,
        imageQuality: 90,
      );
      return picked?.path;
    } catch (e) {
      if (mounted) {
        ToastHelper.showError(context, 'Unable to select image. Please try again.');
      }
      return null;
    }
  }

  Future<void> _pickVerificationImagesFlow({String? targetSlot}) async {
    // Determine which file to pick first
    final bool pickValidIdFirst = targetSlot == 'valid_id' ||
        (targetSlot == null && (_validIdImagePath == null || _validIdImagePath!.isEmpty));

    if (pickValidIdFirst) {
      final validIdPath = await _promptImagePicker(
        title: 'Step 1 of 2: Upload Valid ID',
        description: 'Take a photo or upload your Government / Subdivision Valid ID.',
      );
      if (validIdPath == null || !mounted) return;

      setState(() {
        _validIdImagePath = validIdPath;
        _fieldErrors.remove('valid_id_image');
        _fieldErrors.remove('or_cr_image');
      });

      // Automatically follow up to upload the 2nd file (OR/CR) if not uploaded yet
      if (_orCrImagePath == null || _orCrImagePath!.isEmpty) {
        await Future<void>.delayed(const Duration(milliseconds: 250));
        if (!mounted) return;
        final orCrPath = await _promptImagePicker(
          title: 'Step 2 of 2: Upload Vehicle OR/CR',
          description: 'Now take a photo or upload your Vehicle OR/CR document.',
        );
        if (orCrPath != null && mounted) {
          setState(() {
            _orCrImagePath = orCrPath;
            _fieldErrors.remove('or_cr_image');
            _fieldErrors.remove('valid_id_image');
          });
        }
      }
    } else {
      final orCrPath = await _promptImagePicker(
        title: (_validIdImagePath == null || _validIdImagePath!.isEmpty)
            ? 'Step 1 of 2: Upload Vehicle OR/CR'
            : 'Step 2 of 2: Upload Vehicle OR/CR',
        description: 'Take a photo or upload your Vehicle OR/CR document.',
      );
      if (orCrPath == null || !mounted) return;

      setState(() {
        _orCrImagePath = orCrPath;
        _fieldErrors.remove('or_cr_image');
        _fieldErrors.remove('valid_id_image');
      });

      // Automatically follow up to upload Valid ID if not uploaded yet
      if (_validIdImagePath == null || _validIdImagePath!.isEmpty) {
        await Future<void>.delayed(const Duration(milliseconds: 250));
        if (!mounted) return;
        final validIdPath = await _promptImagePicker(
          title: 'Step 2 of 2: Upload Valid ID',
          description: 'Now take a photo or upload your Government / Subdivision Valid ID.',
        );
        if (validIdPath != null && mounted) {
          setState(() {
            _validIdImagePath = validIdPath;
            _fieldErrors.remove('valid_id_image');
            _fieldErrors.remove('or_cr_image');
          });
        }
      }
    }
  }

  Future<void> _selectBirthDate() async {
    final initialDate = DateTime.tryParse(_birthDateCtrl.text) ?? DateTime(2000, 1, 1);
    final picked = await showCustomCalendarPicker(
      context: context,
      initialDate: initialDate,
    );
    if (picked != null) {
      final formatted =
          "${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}";
      setState(() {
        _birthDateCtrl.text = formatted;
      });
    }
  }

  Future<void> _onFormSubmitPressed() async {
    setState(() {
      _fieldErrors.clear();
    });

    final isFormValid = _formKey.currentState?.validate() ?? false;
    bool hasCustomErrors = false;

    final hasValidId = _validIdImagePath != null && _validIdImagePath!.isNotEmpty;
    final hasOrCr = _orCrImagePath != null && _orCrImagePath!.isNotEmpty;

    if (!hasValidId && !hasOrCr) {
      _fieldErrors['or_cr_image'] = 'Please upload your Valid ID and Vehicle OR/CR';
      hasCustomErrors = true;
      setState(() {});
    } else if (!hasValidId) {
      _fieldErrors['valid_id_image'] = 'Please upload the next file: Valid ID';
      hasCustomErrors = true;
      setState(() {});
    } else if (!hasOrCr) {
      _fieldErrors['or_cr_image'] = 'Please upload the next file: Vehicle OR/CR';
      hasCustomErrors = true;
      setState(() {});
    }

    if (!isFormValid || hasCustomErrors) return;

    await _executeRegistration();
  }

  Future<void> _executeRegistration() async {
    setState(() => _isLoading = true);

    try {
      final authService = ref.read(authServiceProvider);
      final email = _emailCtrl.text.trim();

      final effectiveVehicleType = _selectedVehicleType == 'Other'
          ? (_otherVehicleTypeCtrl.text.trim().isNotEmpty
              ? _otherVehicleTypeCtrl.text.trim()
              : 'Other')
          : _selectedVehicleType;

      final payload = <String, dynamic>{
        'first_name': _firstNameCtrl.text.trim(),
        if (_middleNameCtrl.text.trim().isNotEmpty)
          'middle_name': _middleNameCtrl.text.trim(),
        'last_name': _lastNameCtrl.text.trim(),
        'gender': _selectedGenderId,
        'birth_date': _birthDateCtrl.text,
        'email': email,
        'contact_number': _contactCtrl.text.trim(),
        'role': 'resident',
        'vehicle_type': effectiveVehicleType,
        'car_model': effectiveVehicleType,
        'plate_number': _plateNumberCtrl.text.trim().toUpperCase(),
      };

      await authService.registerResident(
        payload,
        orCrImagePath: _orCrImagePath,
        validIdImagePath: _validIdImagePath,
      );

      if (mounted) {
        // Show Success Modal matching Client works!
        await SuccessModal.show(
          context,
          title: 'Registration complete!',
          message: 'Please wait for a moment while the admin accepts your registration to receive your credentials.',
          autoDismissDuration: const Duration(seconds: 3),
        );
        if (mounted) {
          Navigator.of(context).pushReplacementNamed(AppRouter.login);
        }
      }
    } on DioException catch (e) {
      _parseDioError(e);
    } catch (e) {
      if (mounted) ToastHelper.showError(context, e.toString());
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _parseDioError(DioException e) {
    dynamic data = e.response?.data;
    if (data is String && data.isNotEmpty) {
      try {
        data = jsonDecode(data);
      } catch (_) {}
    }
    if (data is Map) {
      if (data['errors'] != null && data['errors'] is Map) {
        final errors = data['errors'] as Map;
        String? firstMsg;
        errors.forEach((key, val) {
          if (val is List && val.isNotEmpty) {
            _fieldErrors[key.toString()] = val.first.toString();
            firstMsg ??= val.first.toString();
          } else if (val != null) {
            _fieldErrors[key.toString()] = val.toString();
            firstMsg ??= val.toString();
          }
        });
        if (mounted && firstMsg != null) {
          ToastHelper.showError(context, firstMsg!);
        }
        return;
      } else if (data['message'] != null) {
        if (mounted) ToastHelper.showError(context, data['message'].toString());
        return;
      }
    }
    if (mounted) ToastHelper.showError(context, 'Registration failed. Please check your inputs.');
  }

  @override
  Widget build(BuildContext context) {
    return AuthPageLayout(
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Subdivision Logo ─────────────────────────────────────────────
            Center(
              child: Image.asset(
                'assets/images/oakwood-logo.png',
                height: 54.h,
                fit: BoxFit.contain,
                errorBuilder: (_, _, _) => const SizedBox.shrink(),
              ),
            ),
            SizedBox(height: 16.h),

            // ── Top Header Title & Animated Accent Bar ────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Admission Registration',
                        style: TextStyle(
                          fontSize: 22.sp,
                          fontWeight: FontWeight.w400,
                          color: Colors.white,
                          letterSpacing: -0.3,
                        ),
                      ),
                      SizedBox(height: 8.h),
                      AnimatedBuilder(
                        animation: _barAnim,
                        builder: (context, child) {
                          return Container(
                            height: 3.h,
                            width: 140.w * _barAnim.value,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFFA78BFA), Color(0xFF7C3AED)],
                              ),
                              borderRadius: BorderRadius.circular(2.r),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: () => Navigator.of(context).pushReplacementNamed(AppRouter.login),
                  child: Container(
                    padding: EdgeInsets.all(6.r),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withAlpha(20),
                      border: Border.all(color: Colors.white.withAlpha(30)),
                    ),
                    child: Icon(
                      Icons.close,
                      color: Colors.white70,
                      size: 16.r,
                    ),
                  ),
                ),
              ],
            ),
            SizedBox(height: 24.h),

            // ── Form Inputs ───────────────────────────────────────────────
            UnderlineInputField(
              label: 'First Name',
              hint: 'e.g. Juan',
              controller: _firstNameCtrl,
              required: true,
              trailingIcon: Icons.person_outline,
              errorText: _fieldErrors['first_name'],
              validator: (v) => v == null || v.trim().isEmpty ? 'First name is required' : null,
            ),

            UnderlineInputField(
              label: 'Last Name',
              hint: 'e.g. Santos',
              controller: _lastNameCtrl,
              required: true,
              trailingIcon: Icons.person_outline,
              errorText: _fieldErrors['last_name'],
              validator: (v) => v == null || v.trim().isEmpty ? 'Last name is required' : null,
            ),

            UnderlineInputField(
              label: 'Middle Name',
              hint: 'Optional',
              controller: _middleNameCtrl,
              trailingIcon: Icons.person_outline,
              errorText: _fieldErrors['middle_name'],
            ),

            UnderlineInputField(
              label: 'Date of Birth (DD/MM/YYYY)',
              hint: 'mm/dd/yyyy',
              controller: _birthDateCtrl,
              readOnly: true,
              required: true,
              onTap: _selectBirthDate,
              trailingIcon: Icons.calendar_today_outlined,
              errorText: _fieldErrors['birth_date'],
              validator: (v) => v == null || v.trim().isEmpty ? 'Date of birth is required' : null,
            ),

            UnderlineInputField(
              label: 'Email',
              hint: 'you@gmail.com',
              controller: _emailCtrl,
              keyboardType: TextInputType.emailAddress,
              required: true,
              trailingIcon: Icons.email_outlined,
              errorText: _fieldErrors['email'],
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Email is required';
                if (!v.contains('@')) return 'Enter a valid email';
                return null;
              },
            ),

            UnderlineInputField(
              label: 'Contact Number',
              hint: 'e.g. 09171234567',
              controller: _contactCtrl,
              keyboardType: TextInputType.phone,
              required: true,
              maxLength: 11,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(11),
              ],
              trailingIcon: Icons.phone_outlined,
              errorText: _fieldErrors['contact_number'],
              validator: (v) {
                if (v == null || v.trim().isEmpty) {
                  return 'Contact number is required';
                }
                if (v.trim().length != 11) {
                  return 'Contact number must be exactly 11 digits';
                }
                return null;
              },
            ),

            // ── Gender Selection ──────────────────────────────────────────
            Padding(
              padding: EdgeInsets.only(bottom: 20.h),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  RichText(
                    text: TextSpan(
                      text: 'Gender',
                      style: TextStyle(
                        fontSize: 13.sp,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xCCDDD6FE),
                        fontFamily: Theme.of(context).textTheme.bodyMedium?.fontFamily,
                      ),
                      children: const [
                        TextSpan(
                          text: ' *',
                          style: TextStyle(
                            color: Color(0xFFF87171),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: 6.h),
                  Row(
                    children: [
                      _buildRadioOption('Male', 1, _selectedGenderId, (val) {
                        setState(() => _selectedGenderId = val);
                      }),
                      SizedBox(width: 16.w),
                      _buildRadioOption('Female', 2, _selectedGenderId, (val) {
                        setState(() => _selectedGenderId = val);
                      }),
                      SizedBox(width: 16.w),
                      _buildRadioOption('Prefer Not to Say', 3, _selectedGenderId, (val) {
                        setState(() => _selectedGenderId = val);
                      }),
                    ],
                  ),
                ],
              ),
            ),

            // ── Vehicle Type Dropdown ─────────────────────────────────────
            Padding(
              padding: EdgeInsets.only(bottom: _selectedVehicleType == 'Other' ? 8.h : 18.h),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  RichText(
                    text: TextSpan(
                      text: 'Vehicle Type',
                      style: TextStyle(
                        fontSize: 13.sp,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xCCDDD6FE),
                        fontFamily: Theme.of(context).textTheme.bodyMedium?.fontFamily,
                      ),
                      children: const [
                        TextSpan(
                          text: ' *',
                          style: TextStyle(
                            color: Color(0xFFF87171),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: 2.h),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedVehicleType,
                    dropdownColor: const Color(0xFF23153C),
                    iconEnabledColor: const Color(0xCCDDD6FE),
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 14.5.sp,
                      fontWeight: FontWeight.w500,
                    ),
                    decoration: InputDecoration(
                      isDense: true,
                      filled: false,
                      fillColor: Colors.transparent,
                      contentPadding: EdgeInsets.only(bottom: 8.h, top: 4.h),
                      hintText: 'Select vehicle type',
                      hintStyle: TextStyle(
                        color: const Color(0xB3DDD6FE), // Clearly readable light lavender text
                        fontSize: 14.sp,
                        fontWeight: FontWeight.w400,
                      ),
                      errorText: _fieldErrors['vehicle_type'],
                      errorStyle: TextStyle(
                        color: const Color(0xFFF87171),
                        fontSize: 12.sp,
                      ),
                      enabledBorder: const UnderlineInputBorder(
                        borderSide: BorderSide(color: Color(0x33FFFFFF), width: 1.5),
                      ),
                      focusedBorder: const UnderlineInputBorder(
                        borderSide: BorderSide(color: Color(0xFFA78BFA), width: 2.0),
                      ),
                      errorBorder: const UnderlineInputBorder(
                        borderSide: BorderSide(color: Color(0xFFF87171), width: 1.5),
                      ),
                      focusedErrorBorder: const UnderlineInputBorder(
                        borderSide: BorderSide(color: Color(0xFFF87171), width: 2.0),
                      ),
                    ),
                    items: _vehicleTypes
                        .map(
                          (type) => DropdownMenuItem<String>(
                            value: type,
                            child: Text(
                              type,
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      setState(() {
                        _selectedVehicleType = value;
                        _fieldErrors.remove('vehicle_type');
                      });
                    },
                    validator: (v) =>
                        v == null || v.isEmpty ? 'Vehicle type is required' : null,
                  ),
                ],
              ),
            ),

            // ── Specify Other Vehicle Type if "Other" is chosen ───────────
            if (_selectedVehicleType == 'Other')
              UnderlineInputField(
                label: 'Specify Vehicle / Car Model',
                hint: 'e.g. Electric Scooter, Golf Cart, Tricycle, etc.',
                controller: _otherVehicleTypeCtrl,
                required: true,
                trailingIcon: Icons.edit_note_rounded,
                errorText: _fieldErrors['other_vehicle_type'],
                validator: (v) {
                  if (_selectedVehicleType == 'Other' && (v == null || v.trim().isEmpty)) {
                    return 'Please specify your vehicle type or model';
                  }
                  return null;
                },
              ),

            // ── Plate Number ──────────────────────────────────────────────
            UnderlineInputField(
              label: 'Plate Number',
              hint: 'e.g. ABC1234',
              required: true,
              controller: _plateNumberCtrl,
              trailingIcon: Icons.directions_car_outlined,
              errorText: _fieldErrors['plate_number'],
              inputFormatters: [PlateInputFormatter()],
              validator: (v) {
                if (v == null || v.trim().isEmpty) {
                  return 'Plate number is required';
                }
                return null;
              },
            ),

            // ── Valid ID & OR/CR Document Upload (Sequential 2-File Upload) ──
            _buildDocumentUploadField(
              label: 'Valid ID & OR/CR Document (Resident & Vehicle Verification)',
              errorText: _fieldErrors['or_cr_image'] ?? _fieldErrors['valid_id_image'],
            ),

            // ── Auto Credentials Helper Text ──────────────────────────────
            Text(
              'Your username and password will be generated automatically and sent to the email address above.',
              style: TextStyle(
                fontSize: 12.sp,
                color: const Color(0xA6DDD6FE),
                height: 1.4,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 24.h),

            // ── Submit Button (Purple Pill with Arrow) ───────────────────
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _onFormSubmitPressed,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF7C3AED), // bg-violet-600
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: Colors.white30,
                  elevation: 8,
                  shadowColor: const Color(0x664C1D95),
                  padding: EdgeInsets.symmetric(vertical: 14.h),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(30.r),
                  ),
                ),
                child: _isLoading
                    ? SizedBox(
                        height: 20.r,
                        width: 20.r,
                        child: const CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: Colors.white,
                        ),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            'SUBMIT',
                            style: TextStyle(
                              fontSize: 13.5.sp,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.2,
                            ),
                          ),
                          SizedBox(width: 6.w),
                          Icon(
                            Icons.north_east_rounded,
                            size: 16.r,
                          ),
                        ],
                      ),
              ),
            ),
            SizedBox(height: 20.h),

            // ── Sign In Footer Link ───────────────────────────────────────
            Center(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Already have an account? ',
                    style: TextStyle(
                      fontSize: 13.sp,
                      color: const Color(0xE6DDD6FE),
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      Navigator.of(context).pushReplacementNamed(AppRouter.login);
                    },
                    child: Text(
                      'Sign In',
                      style: TextStyle(
                        fontSize: 13.sp,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        decoration: TextDecoration.underline,
                        decorationColor: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRadioOption<T>(
    String label,
    T value,
    T groupValue,
    ValueChanged<T> onChanged,
  ) {
    final isSelected = value == groupValue;
    return GestureDetector(
      onTap: () => onChanged(value),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 16.r,
            height: 16.r,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: isSelected ? const Color(0xFFA78BFA) : Colors.white54,
                width: isSelected ? 5.r : 1.5.r,
              ),
              color: isSelected ? Colors.white : Colors.transparent,
            ),
          ),
          SizedBox(width: 6.w),
          Text(
            label,
            style: TextStyle(
              fontSize: 13.sp,
              color: Colors.white.withAlpha(230),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDocumentUploadField({
    required String label,
    required String? errorText,
  }) {
    final hasValidId = _validIdImagePath != null && _validIdImagePath!.isNotEmpty;
    final hasOrCr = _orCrImagePath != null && _orCrImagePath!.isNotEmpty;
    final hasAnyImage = hasValidId || hasOrCr;
    final hasBothImages = hasValidId && hasOrCr;
    final hasError = errorText != null && errorText.isNotEmpty;

    return Padding(
      padding: EdgeInsets.only(bottom: 18.h),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          RichText(
            text: TextSpan(
              text: label,
              style: TextStyle(
                fontSize: 12.5.sp,
                fontWeight: FontWeight.w500,
                color: const Color(0xCCDDD6FE),
                fontFamily: Theme.of(context).textTheme.bodyMedium?.fontFamily,
              ),
              children: const [
                TextSpan(
                  text: ' *',
                  style: TextStyle(
                    color: Color(0xFFF87171),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: 8.h),
          GestureDetector(
            onTap: hasBothImages ? null : () => _pickVerificationImagesFlow(),
            child: Container(
              width: double.infinity,
              padding: EdgeInsets.all(12.r),
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(12),
                borderRadius: BorderRadius.circular(12.r),
                border: Border.all(
                  color: hasError
                      ? const Color(0xFFF87171)
                      : hasBothImages
                          ? const Color(0xFF10B981).withAlpha(160)
                          : hasAnyImage
                              ? const Color(0xFFA78BFA).withAlpha(180)
                              : Colors.white24,
                  width: hasError || hasAnyImage ? 1.4 : 1.0,
                ),
              ),
              child: !hasAnyImage
                  ? Row(
                      children: [
                        Container(
                          padding: EdgeInsets.all(10.r),
                          decoration: BoxDecoration(
                            color: const Color(0xFF7C3AED).withAlpha(45),
                            borderRadius: BorderRadius.circular(10.r),
                          ),
                          child: Icon(
                            Icons.fact_check_outlined,
                            color: const Color(0xFFA78BFA),
                            size: 22.r,
                          ),
                        ),
                        SizedBox(width: 12.w),
                        Expanded(
                          child: Text(
                            'Tap to take a photo or upload image',
                            style: TextStyle(
                              fontSize: 13.sp,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        Icon(
                          Icons.camera_alt_outlined,
                          color: Colors.white54,
                          size: 18.r,
                        ),
                      ],
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: _buildDocumentSlotItem(
                                slotTitle: '1. Valid ID',
                                imagePath: _validIdImagePath,
                                onPick: () => _pickVerificationImagesFlow(targetSlot: 'valid_id'),
                                onRemove: () => setState(() => _validIdImagePath = null),
                              ),
                            ),
                            SizedBox(width: 10.w),
                            Expanded(
                              child: _buildDocumentSlotItem(
                                slotTitle: '2. Vehicle OR/CR',
                                imagePath: _orCrImagePath,
                                onPick: () => _pickVerificationImagesFlow(targetSlot: 'or_cr'),
                                onRemove: () => setState(() => _orCrImagePath = null),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
            ),
          ),
          if (hasError) ...[
            SizedBox(height: 5.h),
            Text(
              errorText,
              style: TextStyle(
                fontSize: 11.5.sp,
                color: const Color(0xFFF87171),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDocumentSlotItem({
    required String slotTitle,
    required String? imagePath,
    required VoidCallback onPick,
    required VoidCallback onRemove,
  }) {
    final isUploaded = imagePath != null && imagePath.isNotEmpty;

    if (!isUploaded) {
      return GestureDetector(
        onTap: onPick,
        child: Container(
          height: 126.h,
          padding: EdgeInsets.all(10.r),
          decoration: BoxDecoration(
            color: const Color(0xFF7C3AED).withAlpha(30),
            borderRadius: BorderRadius.circular(10.r),
            border: Border.all(
              color: const Color(0xFFA78BFA).withAlpha(140),
              width: 1.2,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.add_a_photo_outlined,
                color: const Color(0xFFC4B5FD),
                size: 22.r,
              ),
              SizedBox(height: 6.h),
              Text(
                slotTitle,
                style: TextStyle(
                  fontSize: 11.5.sp,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
                textAlign: TextAlign.center,
              ),
              SizedBox(height: 2.h),
              Text(
                'Tap to upload next file',
                style: TextStyle(
                  fontSize: 10.sp,
                  color: const Color(0xFFC4B5FD),
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return Container(
      padding: EdgeInsets.all(6.r),
      decoration: BoxDecoration(
        color: Colors.black.withAlpha(55),
        borderRadius: BorderRadius.circular(10.r),
        border: Border.all(
          color: const Color(0xFF10B981).withAlpha(120),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(7.r),
                child: SizedBox(
                  height: 82.h,
                  width: double.infinity,
                  child: Image.file(
                    File(imagePath),
                    fit: BoxFit.cover,
                  ),
                ),
              ),
              Positioned(
                top: 4.r,
                right: 4.r,
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: onPick,
                      child: Container(
                        padding: EdgeInsets.all(4.r),
                        decoration: BoxDecoration(
                          color: Colors.black.withAlpha(170),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.edit_outlined,
                          size: 13.r,
                          color: const Color(0xFFC4B5FD),
                        ),
                      ),
                    ),
                    SizedBox(width: 4.w),
                    GestureDetector(
                      onTap: onRemove,
                      child: Container(
                        padding: EdgeInsets.all(4.r),
                        decoration: BoxDecoration(
                          color: Colors.black.withAlpha(170),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.close_rounded,
                          size: 13.r,
                          color: const Color(0xFFF87171),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 6.h),
          Row(
            children: [
              Icon(
                Icons.check_circle_rounded,
                color: const Color(0xFF10B981),
                size: 13.r,
              ),
              SizedBox(width: 4.w),
              Expanded(
                child: Text(
                  slotTitle,
                  style: TextStyle(
                    fontSize: 11.sp,
                    color: const Color(0xFF6EE7B7),
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
