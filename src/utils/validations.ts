import * as z from 'zod';

// Maximum file size (4MB in bytes)
const MAX_FILE_SIZE = 4 * 1024 * 1024;

// Accepted file types
const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email(),
  password: z.string(),
});

export type LoginSchemaType = z.infer<typeof loginSchema>;

// userInfoForm schema
export const userInfoSchema = z.object({
  username: z
    .string()
    .min(4, 'Username should be at least 4 characters long.')
    .max(100, 'Name cannot be longer than 100 characters'),
  email: z.string().email(),
});
export type UserInfoSchemaType = z.infer<typeof userInfoSchema>;

// change password schema
export const changePasswordSchema = z
  .object({
    newpassword: z
      .string()
      .min(5, 'Password must be at least 5 characters long')
      .max(32, 'Password must not exceed 32 characters')
      .regex(
        /^(?=.*[\d@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
        'Password must include at least one digit or special character'
      ),
    confirmpassword: z.string(),
  })
  .refine(data => data.newpassword === data.confirmpassword, {
    message: 'Passwords do not match',
    path: ['confirmpassword'], // 👈 This attaches the error to the confirmpassword field
  });

export type ChangePasswordSchemaType = z.infer<typeof changePasswordSchema>;

export const uploadProjectSchema = z.object({
  projectName: z
    .string()
    .min(1, 'Project name is required')
    .min(3, 'Project name must be at least 3 characters')
    .max(100, 'Project name must be less than 100 characters')
    .trim(),

  file: z
    .unknown()
    .refine(file => file instanceof File, 'Please select a file')
    .refine(file => file && (file as File).size > 0, 'File is required')
    .refine(
      file => !file || (file as File).size <= MAX_FILE_SIZE,
      'File size must be less than 4MB'
    )
    .refine(
      file => !file || ACCEPTED_FILE_TYPES.includes((file as File).type),
      'Only PDF and Images are allowed'
    )

    .transform(file => file as File),
});

export type UploadProjectFormData = z.infer<typeof uploadProjectSchema>;

export const editProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
});

export type EditProjectFormData = z.infer<typeof editProjectSchema>;
